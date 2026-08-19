use std::fmt::Debug;
use std::ops::RangeBounds;

use crate::data_structures::index_range::resolve_range;
use crate::data_structures::slot_allocator::SlotAllocator;
use crate::data_structures::treearray::TreeArray;
use crate::domain::child_link::ChildLink;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;
use crate::domain::table_row_iter::{RowIter, UnorderedRowIter};
use crate::domain::table_trait::TableTrait;

/// Rows are stored at physical slots shared across all columns, with a tree
/// mapping user index to slot so reordering moves no cells.
#[derive(Debug)]
pub struct UnorderedTable {
    columns: Vec<Box<dyn Column>>,
    logical_order: TreeArray<usize>, // user_index -> physical slot
    slots: SlotAllocator,
    /// Set once a column is reserved for child links.
    child_column: Option<usize>,
}

#[allow(dead_code)]
impl UnorderedTable {
    pub fn new() -> Self {
        Self {
            columns: Vec::new(),
            logical_order: TreeArray::<usize>::new(),
            slots: SlotAllocator::new(),
            child_column: None,
        }
    }

    pub fn get_logical_order(&self) -> TreeArray<usize> {
        self.logical_order.clone()
    }

    /// How far the columns extend, which exceeds [`nrows`](TableTrait::nrows)
    /// while freed slots await reuse.
    pub fn physical_capacity(&self) -> usize {
        self.slots.capacity()
    }

    /// Freed slots awaiting reuse, ascending.
    pub fn free_physical_slots(&self) -> Vec<usize> {
        (0..self.slots.capacity())
            .filter(|&slot| !self.slots.is_live(slot))
            .collect()
    }

    fn column(&self, col: usize) -> DomainResult<&dyn Column> {
        self.columns
            .get(col)
            .map(|boxed| boxed.as_ref())
            .ok_or(DomainError::IndexOutOfBounds {
                index: col,
                len: self.columns.len(),
            })
    }

    /// Validated before any slot is allocated or mutated.
    fn validate_row(&self, row: &[Value]) -> DomainResult<()> {
        if row.len() != self.columns.len() {
            return Err(DomainError::RowLengthMismatch {
                expected: self.columns.len(),
                actual: row.len(),
            });
        }
        for (val, col) in row.iter().zip(self.columns.iter()) {
            col.accepts(val)?;
        }
        Ok(())
    }

    /// Frees the row's physical slot for reuse.
    pub fn delete_row(&mut self, user_idx: usize) -> DomainResult<()> {
        self.guard_child_row(user_idx)?;
        let phys = self.logical_order.try_get(user_idx)?;
        self.logical_order.delete(user_idx)?;
        self.slots.free(phys)?;
        Ok(())
    }

    /// Shifts subsequent rows up.
    pub fn insert_row(&mut self, user_idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        self.guard_child_values(&row)?;
        if user_idx > self.logical_order.len() {
            return Err(DomainError::IndexOutOfBounds {
                index: user_idx,
                len: self.logical_order.len(),
            });
        }

        // Allocated only after the checks above, so a rejected row leaks no slot.
        let phys_idx = self.slots.allocate()?;

        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while phys_idx >= col.len() {
                col.push_empty();
            }
            col.update(phys_idx, val)?;
        }

        // `?` rather than a tail expression, so the error is converted.
        self.logical_order.insert(user_idx, phys_idx)?;
        Ok(())
    }

    /// Exchanges two rows' user indices, leaving their physical slots in place.
    pub fn swap_rows(&mut self, idx1: usize, idx2: usize) -> DomainResult<()> {
        if idx1 == idx2 {
            return Ok(());
        }
        let p1 = self.logical_order.try_get(idx1)?;
        let p2 = self.logical_order.try_get(idx2)?;
        self.logical_order.set(idx1, p2)?;
        self.logical_order.set(idx2, p1)?;
        Ok(())
    }
}

impl TableTrait for UnorderedTable {
    type Rows<'a> = UnorderedRowIter<'a>;

    fn add_column<C: Column + 'static>(&mut self, col: C) { self.columns.push(Box::new(col)) }

    fn set_child_cell(&mut self, row: usize, col: usize, link: ChildLink) -> DomainResult<()> {
        let phys = self.logical_order.try_get(row)?;
        let column = self
            .columns
            .get_mut(col)
            .ok_or(DomainError::IndexOutOfBounds { index: col, len: 0 })?;
        while phys >= column.len() {
            column.push_empty();
        }
        column.update(phys, Value::Child(link))
    }

    fn child_column(&self) -> Option<usize> {
        self.child_column
    }

    fn set_child_column(&mut self, col: usize) -> DomainResult<()> {
        let column = self.column(col)?;
        if column.accepts(&Value::Child(ChildLink::EMPTY)).is_err() {
            return Err(DomainError::NotAChildColumn { column: col });
        }
        self.child_column = Some(col);
        Ok(())
    }

    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()> {
        let idx = self.logical_order.len();
        self.insert_row(idx, row)
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        self.guard_child_row(idx)?;
        self.guard_child_values(&row)?;
        let phys_idx = self.logical_order.try_get(idx)?;
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while phys_idx >= col.len() { col.push_empty(); }
            col.update(phys_idx, val)?;
        }
        Ok(())
    }

    fn print_table(&self) -> DomainResult<()> {
        if self.columns.is_empty() || self.logical_order.is_empty() {
            println!("(empty table)");
            return Ok(());
        }
        // One lazy walk instead of a `try_get` per row per column.
        let physical: Vec<usize> = self.logical_order.iter().copied().collect();
        let mut widths = Vec::new();
        for col in &self.columns {
            let mut max_width = col.name().len();
            for &phys_idx in &physical {
                let val = col.get_value(phys_idx)?;
                if val.len() > max_width { max_width = val.len(); }
            }
            widths.push(max_width);
        }
        // header
        for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() { if i>0 {print!(" ")}; print!("{:<width$}", col.name(), width=w); }
        println!();
        for (i, w) in widths.iter().enumerate() { if i>0 {print!(" ")}; print!("{}", "-".repeat(*w)); }
        println!();
        // rows
        for &phys_idx in &physical {
            for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() {
                if i>0 { print!(" "); }
                print!("{:<width$}", col.get_value(phys_idx)?, width=w);
            }
            println!();
        }
        Ok(())
    }

    /// The logical order's length, which the columns may exceed because freed
    /// slots stay allocated.
    fn nrows(&self) -> usize {
        self.logical_order.len()
    }

    /// `O(log n + m)` for `m` rows rather than `O(m log n)`.
    fn iter_rows(&self) -> Self::Rows<'_> {
        RowIter::new(&self.columns, self.logical_order.iter().copied())
    }

    fn row_range<R: RangeBounds<usize>>(&self, range: R) -> DomainResult<Self::Rows<'_>> {
        // `TreeArray::range` applies the same bound checks over the same length.
        let indices = self.logical_order.range(range)?;
        Ok(RowIter::new(&self.columns, indices.copied()))
    }

    fn insert_row_at(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.insert_row(idx, row)
    }

    fn validate(&self, row: &[Value]) -> DomainResult<()> {
        self.validate_row(row)
    }

    fn ncols(&self) -> usize {
        self.columns.len()
    }

    fn column_names(&self) -> Vec<&str> {
        self.columns.iter().map(|col| col.name()).collect()
    }

    fn row(&self, idx: usize) -> DomainResult<Vec<Value>> {
        self.row_range(idx..=idx)?
            .next()
            .unwrap_or(Err(DomainError::IndexOutOfBounds {
                index: idx,
                len: self.nrows(),
            }))
    }

    fn cell(&self, row: usize, col: usize) -> DomainResult<Value> {
        let phys = self.logical_order.try_get(row)?;
        self.column(col)?.get(phys)
    }

    fn cell_display(&self, row: usize, col: usize) -> DomainResult<String> {
        let phys = self.logical_order.try_get(row)?;
        self.column(col)?.get_value(phys)
    }

    fn iter_column(&self, col: usize) -> DomainResult<impl Iterator<Item = DomainResult<Value>>> {
        let column = self.column(col)?;
        // One lazy tree walk, so the whole column costs `O(log n + m)`.
        Ok(self
            .logical_order
            .iter()
            .copied()
            .map(move |phys| column.get(phys)))
    }

    fn update_cell(&mut self, row: usize, col: usize, val: Value) -> DomainResult<()> {
        self.guard_child_column(col)?;
        let phys = self.logical_order.try_get(row)?;
        let ncols = self.columns.len();
        let column = self
            .columns
            .get_mut(col)
            .ok_or(DomainError::IndexOutOfBounds { index: col, len: ncols })?;
        column.accepts(&val)?;
        while phys >= column.len() {
            column.push_empty();
        }
        column.update(phys, val)
    }

    fn swap_rows_at(&mut self, first: usize, second: usize) -> DomainResult<()> {
        self.swap_rows(first, second)
    }

    fn remove_row(&mut self, idx: usize) -> DomainResult<Vec<Value>> {
        self.guard_child_row(idx)?;
        // Read before deleting, since the row is returned to the caller.
        let removed = self.row(idx)?;
        self.delete_row(idx)?;
        Ok(removed)
    }

    fn remove_row_range<R: RangeBounds<usize>>(
        &mut self,
        range: R,
    ) -> DomainResult<Vec<Vec<Value>>> {
        let range = resolve_range(range, self.nrows())?;
        let mut removed = Vec::with_capacity(range.len());
        // Always removing at `start` walks the range as later rows shift down.
        for _ in range.clone() {
            removed.push(self.remove_row(range.start)?);
        }
        Ok(removed)
    }

    fn clear_rows(&mut self) -> DomainResult<()> {
        self.guard_child_links_absent()?;
        for col in self.columns.iter_mut() {
            col.clear();
        }
        self.logical_order.clear();
        self.slots.clear();
        Ok(())
    }
}
