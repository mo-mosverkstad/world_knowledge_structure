//! Registry owning every table, addressing them by a stable id.

use crate::data_structures::slot_allocator::SlotAllocator;
use crate::domain::child_link::ChildLink;
use crate::domain::table_column::Value;
use crate::domain::table_trait::TableTrait;
use crate::domain::error::{DomainError, DomainResult};

/// Stable id of a registered table.
///
/// Remains valid until the table is deleted, independently of how many other
/// tables are registered or removed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct TableId(usize);

impl TableId {
    pub fn index(self) -> usize {
        self.0
    }
}

/// A registered table together with the number of rows pointing at it.
#[derive(Debug)]
struct Entry<T> {
    table: T,
    name: String,
    /// One per referencing row, so a table referenced by two rows counts 2.
    references: usize,
}

/// Owns tables by [`TableId`] and refuses to delete one that is still referenced.
///
/// Ids come from a [`SlotAllocator`], so a deleted table's id is reused later. That
/// is only safe because a referenced table cannot be deleted: no live reference can
/// outlive its target and be silently reattached to a different table.
#[derive(Debug)]
pub struct TableRegistry<T> { // Comment: use generic T, since both ordered and unordered tables are allowed
    /// Indexed by id; `None` where an id has been freed.
    entries: Vec<Option<Entry<T>>>,
    ids: SlotAllocator,
}

impl<T> TableRegistry<T> {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            ids: SlotAllocator::new(),
        }
    }

    /// Number of registered tables.
    pub fn len(&self) -> usize {
        self.ids.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn contains(&self, id: TableId) -> bool {
        self.ids.is_live(id.0)
    }

    pub fn register(&mut self, name: &str, table: T) -> DomainResult<TableId> {
        let slot = self.ids.allocate()?;
        if slot >= self.entries.len() {
            self.entries.resize_with(slot + 1, || None);
        }
        self.entries[slot] = Some(Entry {
            table,
            name: name.to_string(),
            references: 0,
        });
        Ok(TableId(slot))
    }

    pub fn get(&self, id: TableId) -> DomainResult<&T> {
        Ok(&self.entry(id)?.table)
    }

    pub fn get_mut(&mut self, id: TableId) -> DomainResult<&mut T> {
        Ok(&mut self.entry_mut(id)?.table)
    }

    pub fn name(&self, id: TableId) -> DomainResult<&str> {
        Ok(&self.entry(id)?.name)
    }

    pub fn rename(&mut self, id: TableId, name: &str) -> DomainResult<String> {
        let entry = self.entry_mut(id)?;
        Ok(std::mem::replace(&mut entry.name, name.to_string()))
    }

    /// Rows currently pointing at `id`.
    pub fn references(&self, id: TableId) -> DomainResult<usize> {
        Ok(self.entry(id)?.references)
    }

    /// Records one more row pointing at `id`.
    fn add_reference(&mut self, id: TableId) -> DomainResult<usize> {
        let entry = self.entry_mut(id)?;
        entry.references += 1;
        Ok(entry.references)
    }

    /// Records that one referencing row is gone.
    ///
    /// Dropping a reference that was never counted means the count no longer
    /// matches reality, so it is reported as [`DomainError::RefcountCorrupted`]
    /// rather than saturating at zero and hiding the mistake.
    fn drop_reference(&mut self, id: TableId) -> DomainResult<usize> {
        let entry = self.entry_mut(id)?;
        if entry.references == 0 {
            return Err(DomainError::RefcountCorrupted { table: id.0 });
        }
        entry.references -= 1;
        Ok(entry.references)
    }

    /// Reads the child link in `parent`'s row, if the table has a child column.
    pub fn child_of(&self, parent: TableId, row: usize) -> DomainResult<Option<TableId>>
    where
        T: TableTrait,
    {
        let table = self.get(parent)?;
        let Some(col) = table.child_column() else {
            return Ok(None);
        };
        match table.cell(row, col)? {
            Value::Child(link) => Ok(link.target().map(TableId)),
            _ => Err(DomainError::NotAChildColumn { column: col }),
        }
    }

    /// Points `parent`'s row at `child`, adjusting both reference counts.
    ///
    /// This is the only way to create a child link, which is what keeps the counts
    /// in step with the links that actually exist. Replacing an existing link
    /// releases the old target in the same call.
    pub fn set_child(&mut self, parent: TableId, row: usize, child: TableId) -> DomainResult<()>
    where
        T: TableTrait,
    {
        if !self.contains(child) {
            return Err(DomainError::TableNotFound { table: child.0 });
        }
        let previous = self.child_of(parent, row)?;
        if previous == Some(child) {
            return Ok(());
        }
        let col = self
            .get(parent)?
            .child_column()
            .ok_or(DomainError::NotAChildColumn { column: 0 })?;
        // Written before the counts move, so a rejected write leaves them alone.
        self.entry_mut(parent)?
            .table
            .set_child_cell(row, col, ChildLink::to(child.0))?;
        if let Some(previous) = previous {
            self.drop_reference(previous)?;
        }
        self.add_reference(child)?;
        Ok(())
    }

    /// Clears the child link in `parent`'s row, releasing its target.
    pub fn clear_child(&mut self, parent: TableId, row: usize) -> DomainResult<()>
    where
        T: TableTrait,
    {
        let Some(previous) = self.child_of(parent, row)? else {
            return Ok(());
        };
        let col = self
            .get(parent)?
            .child_column()
            .ok_or(DomainError::NotAChildColumn { column: 0 })?;
        self.entry_mut(parent)?
            .table
            .set_child_cell(row, col, ChildLink::EMPTY)?;
        self.drop_reference(previous)?;
        Ok(())
    }

    /// Whether `id` can be deleted, i.e. nothing references it.
    pub fn is_deletable(&self, id: TableId) -> DomainResult<bool> {
        Ok(self.entry(id)?.references == 0)
    }

    /// Removes an unreferenced table and returns it, freeing its id for reuse.
    ///
    /// A table with references is refused with
    /// [`DomainError::TableStillReferenced`]; the caller clears them and retries.
    pub fn remove(&mut self, id: TableId) -> DomainResult<T> {
        let entry = self.entry(id)?;
        if entry.references > 0 {
            return Err(DomainError::TableStillReferenced {
                table: id.0,
                references: entry.references,
            });
        }
        self.ids.free(id.0)?; // Comment: may not free if the table cannot be taken???
        let entry = self.entries[id.0]
            .take()
            .ok_or(DomainError::TableNotFound { table: id.0 })?;
        Ok(entry.table)
    }

    /// Every registered id, ascending.
    pub fn ids(&self) -> impl Iterator<Item = TableId> + '_ {
        self.ids.live_slots().map(TableId)
    }

    /// Every registered table with its id, ascending by id.
    pub fn iter(&self) -> impl Iterator<Item = (TableId, &T)> + '_ {
        self.entries
            .iter()
            .enumerate()
            .filter_map(|(slot, entry)| entry.as_ref().map(|e| (TableId(slot), &e.table)))
    }

    /// Id of the first table registered under `name`.
    pub fn find_by_name(&self, name: &str) -> Option<TableId> {
        self.entries
            .iter()
            .enumerate()
            .find_map(|(slot, entry)| match entry {
                Some(e) if e.name == name => Some(TableId(slot)),
                _ => None,
            })
    }

    fn entry(&self, id: TableId) -> DomainResult<&Entry<T>> {
        self.entries
            .get(id.0)
            .and_then(|entry| entry.as_ref())
            .ok_or(DomainError::TableNotFound { table: id.0 })
    }

    fn entry_mut(&mut self, id: TableId) -> DomainResult<&mut Entry<T>> {
        self.entries
            .get_mut(id.0)
            .and_then(|entry| entry.as_mut())
            .ok_or(DomainError::TableNotFound { table: id.0 })
    }
}

impl<T> Default for TableRegistry<T> {
    fn default() -> Self {
        Self::new()
    }
}
