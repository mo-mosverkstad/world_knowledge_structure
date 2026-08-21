//! Lazy row iteration shared by the table implementations.
//!
//! A row is one cell per column at the same physical index; the tables differ only
//! in which indices to visit, so that sequence is a type parameter. The tables hand
//! the result out as a boxed iterator (`BoxRows`), so this type is generic here and
//! erased at the trait boundary.

use crate::domain::error::DomainResult;
use crate::domain::table_column::{Column, Value};

/// Lazy iterator over table rows, assembling one row per [`Iterator::next`] call.
///
/// Items are [`DomainResult`] because reading a cell is fallible; an `Err` means a
/// column was shorter than the row count, which the table operations prevent.
pub struct RowIter<'a, I> {
    columns: &'a [Box<dyn Column>],
    /// Physical indices still to visit, in user order.
    indices: I,
}

impl<'a, I> RowIter<'a, I> {
    /// Crate-internal: the indices are bound-checked by the table beforehand.
    pub(crate) fn new(columns: &'a [Box<dyn Column>], indices: I) -> Self {
        Self { columns, indices }
    }

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

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.indices.size_hint()
    }
}

impl<'a, I: ExactSizeIterator<Item = usize>> ExactSizeIterator for RowIter<'a, I> {}
