//! Lazy row iteration shared by the table implementations.
//!
//! A table stores each row spread across its columns, so "reading a row" means
//! gathering one cell per column at the same physical index. What differs
//! between the tables is only *which* physical indices to visit, and in what
//! order:
//!
//! * [`OrderedTable`](crate::domain::ordered_table::OrderedTable) stores rows in
//!   user order, so the index sequence is the requested range itself;
//! * [`UnorderedTable`](crate::domain::unordered_table::UnorderedTable) keeps a
//!   `TreeArray<usize>` mapping user index to physical slot, so the sequence is
//!   that tree walked over the requested range.
//!
//! [`RowIter`] therefore takes the index sequence as a type parameter and owns
//! only the row-materialising half. Both tables reuse it, and the lazy
//! `TreeArray` walk keeps the unordered case at `O(log n + m)` for `m` rows
//! rather than the `O(m log n)` of one `try_get` per row.

use std::iter::Copied;
use std::ops::Range;

use crate::domain::error::DomainResult;
use crate::domain::table_column::{Column, Value};
use crate::domain::treearray::TreeArrayIter;

/// Lazy iterator over table rows, yielding each row as the `Vec<Value>` it was
/// fed to the table as.
///
/// Nothing is materialised up front: one row is assembled per [`Iterator::next`]
/// call, so a caller that stops early pays only for the rows it consumed.
///
/// Reading a cell is fallible ([`Column::get`] reports an out-of-bounds slot
/// rather than panicking), so the item type is a [`DomainResult`]. In a
/// consistent table every row succeeds; an `Err` means a column was shorter than
/// the row count, which the table operations are written to prevent.
///
/// Borrowing the table immutably means it cannot be modified while an iterator
/// is alive, so the index sequence cannot go stale mid-walk.
pub struct RowIter<'a, I> {
    /// The table's columns, read at each visited index.
    columns: &'a [Box<dyn Column>],
    /// Physical indices still to visit, in user order.
    indices: I,
}

/// Row iterator over an `OrderedTable`, whose rows sit at consecutive indices.
pub type OrderedRowIter<'a> = RowIter<'a, Range<usize>>;

/// Row iterator over an `UnorderedTable`, driven by the lazy walk of its
/// logical-order tree.
pub type UnorderedRowIter<'a> = RowIter<'a, Copied<TreeArrayIter<'a, usize>>>;

impl<'a, I> RowIter<'a, I> {
    /// Wraps an already-validated index sequence. The bound checks belong to the
    /// table, which is why this is crate-internal: by the time a `RowIter`
    /// exists, every index it will visit is known to be in bounds.
    pub(crate) fn new(columns: &'a [Box<dyn Column>], indices: I) -> Self {
        Self { columns, indices }
    }

    /// Gathers one cell per column into a row, in column order, which is the
    /// order the row was supplied in.
    fn read_row(&self, physical: usize) -> DomainResult<Vec<Value>> {
        let mut row = Vec::with_capacity(self.columns.len());
        for col in self.columns {
            row.push(col.get(physical)?);
        }
        Ok(row)
    }
}

impl<'a, I: Iterator<Item = usize>> Iterator for RowIter<'a, I> {
    type Item = DomainResult<Vec<Value>>;

    fn next(&mut self) -> Option<Self::Item> {
        let physical = self.indices.next()?;
        Some(self.read_row(physical))
    }

    /// Inherited from the index sequence, which knows its own length; lets
    /// callers size a buffer in one allocation.
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.indices.size_hint()
    }
}

impl<'a, I: ExactSizeIterator<Item = usize>> ExactSizeIterator for RowIter<'a, I> {}
