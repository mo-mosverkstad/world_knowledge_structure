use std::fmt::Debug;
use std::ops::RangeBounds;

use crate::data_structures::index_range::resolve_range;
use crate::domain::child_link::ChildLink;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;

pub trait TableTrait: Debug {
    /// Concrete type differs per table, since each sequences physical indices its
    /// own way; all that callers rely on is that rows come in user order.
    type Rows<'a>: Iterator<Item = DomainResult<Vec<Value>>>
    where
        Self: 'a;

    fn add_column<C: Column + 'static>(&mut self, col: C);

    /// Index of the column holding child links, if this table is non-leaf.
    fn child_column(&self) -> Option<usize>;

    /// Reserves an existing `Child` column as this table's child column, after
    /// which ordinary writes to it are refused and only the registry may set it.
    fn set_child_column(&mut self, col: usize) -> DomainResult<()>;

    /// Writes the child column, bypassing the guard that blocks ordinary writes.
    ///
    /// Crate-internal so only the registry can reach it: it is the counted write,
    /// and calling it directly would leave the counts disagreeing with the links.
    fn set_child_cell(&mut self, row: usize, col: usize, link: ChildLink) -> DomainResult<()>;

    /// Rejects a write that would touch the child column outside the registry.
    fn guard_child_column(&self, col: usize) -> DomainResult<()> {
        match self.child_column() {
            Some(child) if child == col => {
                Err(DomainError::ChildColumnProtected { column: col })
            }
            _ => Ok(()),
        }
    }

    /// Rejects a supplied row that carries a populated child link, since creating
    /// an edge is what the registry counts.
    fn guard_child_values(&self, row: &[Value]) -> DomainResult<()> {
        if let Some(col) = self.child_column() {
            match row.get(col) {
                Some(Value::Child(link)) if !link.is_empty() => {
                    return Err(DomainError::ChildColumnProtected { column: col });
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// Rejects clearing a table while any row still holds a child link.
    fn guard_child_links_absent(&self) -> DomainResult<()> {
        if let Some(col) = self.child_column() {
            for row in 0..self.nrows() {
                if let Ok(Value::Child(link)) = self.cell(row, col)
                    && !link.is_empty()
                {
                    return Err(DomainError::ChildLinkPresent { row });
                }
            }
        }
        Ok(())
    }

    /// Rejects a whole-row write on a non-leaf table, since it would overwrite the
    /// child link along with everything else.
    fn guard_child_row(&self, row: usize) -> DomainResult<()> {
        match self.child_column() {
            Some(col) => match self.cell(row, col) {
                // An empty link has nothing to lose, so the write is harmless.
                Ok(Value::Child(link)) if link.is_empty() => Ok(()),
                Ok(Value::Child(_)) => Err(DomainError::ChildLinkPresent { row }),
                // A row that does not exist yet holds no link.
                _ => Ok(()),
            },
            None => Ok(()),
        }
    }
    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()>;
    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()>;
    fn print_table(&self) -> DomainResult<()>;

    /// Exclusive upper bound of a valid row index.
    fn nrows(&self) -> usize;

    /// Lazily reads every row. On a `TreeArray`-backed table this costs
    /// `O(log n + m)` for `m` rows rather than `O(m log n)`.
    fn iter_rows(&self) -> Self::Rows<'_>;

    /// Lazily reads the rows in `range`, accepting any Rust range syntax and
    /// validating it up front. `row_range(..)` always succeeds and equals
    /// [`iter_rows`](Self::iter_rows).
    fn row_range<R: RangeBounds<usize>>(&self, range: R) -> DomainResult<Self::Rows<'_>>;

    // ---------------- Create ----------------

    /// `idx == nrows()` appends.
    fn insert_row_at(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()>;

    /// Appends every row, or none if any is invalid.
    fn append_rows(&mut self, rows: Vec<Vec<Value>>) -> DomainResult<()> {
        for row in &rows {
            self.validate(row)?;
        }
        for row in rows {
            self.append_row(row)?;
        }
        Ok(())
    }

    // ---------------- Read ----------------

    /// Rejects a row that does not match the columns, without mutating anything.
    fn validate(&self, row: &[Value]) -> DomainResult<()>;

    fn ncols(&self) -> usize;

    fn column_names(&self) -> Vec<&str>;

    fn is_empty(&self) -> bool {
        self.nrows() == 0
    }

    /// The row at user index `idx`.
    fn row(&self, idx: usize) -> DomainResult<Vec<Value>>;

    /// One cell, without materialising the rest of its row.
    fn cell(&self, row: usize, col: usize) -> DomainResult<Value>;

    /// The display form of one cell, as `print_table` would render it.
    fn cell_display(&self, row: usize, col: usize) -> DomainResult<String>;

    /// Lazily reads one column top to bottom, in user row order.
    fn iter_column(&self, col: usize) -> DomainResult<impl Iterator<Item = DomainResult<Value>>>;

    /// User index of the first row satisfying `predicate`.
    fn find_row<F>(&self, mut predicate: F) -> DomainResult<Option<usize>>
    where
        F: FnMut(&[Value]) -> bool,
    {
        for (idx, row) in self.iter_rows().enumerate() {
            if predicate(&row?) {
                return Ok(Some(idx));
            }
        }
        Ok(None)
    }

    // ---------------- Update ----------------

    /// Overwrites one cell, leaving the rest of the row alone.
    fn update_cell(&mut self, row: usize, col: usize, val: Value) -> DomainResult<()>;

    /// Exchanges two rows' positions.
    fn swap_rows_at(&mut self, first: usize, second: usize) -> DomainResult<()>;

    /// Relocates the row at `from` so it ends up at index `to`.
    fn move_row(&mut self, from: usize, to: usize) -> DomainResult<()> {
        self.move_row_range(from..=from, to)
    }

    /// Relocates the rows in `range` so the block starts at `to`, keeping their
    /// contents and relative order.
    ///
    /// `to` is the block's position in the resulting order, so it is bounded by
    /// `nrows() - count` rather than `nrows()`. The destination is checked before
    /// anything moves.
    fn move_row_range<R: RangeBounds<usize>>(&mut self, range: R, to: usize) -> DomainResult<()> {
        let range = resolve_range(range, self.nrows())?;
        let count = range.len();
        // Furthest start at which the block still fits; one past it is the first
        // invalid destination.
        let limit = self.nrows() - count;
        if to > limit {
            return Err(DomainError::IndexOutOfBounds {
                index: to,
                len: limit + 1,
            });
        }
        if count == 0 || to == range.start {
            return Ok(());
        }
        let rows = self.remove_row_range(range)?;
        for (offset, row) in rows.into_iter().enumerate() {
            self.insert_row_at(to + offset, row)?;
        }
        Ok(())
    }

    // ---------------- Delete ----------------

    fn remove_row(&mut self, idx: usize) -> DomainResult<Vec<Value>>;

    /// Removes the rows in `range`, returning them in order.
    fn remove_row_range<R: RangeBounds<usize>>(
        &mut self,
        range: R,
    ) -> DomainResult<Vec<Vec<Value>>>;

    /// Removes every row, keeping the columns.
    /// Refused while any row still holds a child link, which must be cleared
    /// through the registry first.
    fn clear_rows(&mut self) -> DomainResult<()>;
}
