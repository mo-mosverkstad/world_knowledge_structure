use std::fmt::Debug;
use std::ops::RangeBounds;

use crate::domain::child_link::ChildLink;
use crate::domain::error::{DomainError, DomainResult};
use crate::data_structures::index_range::resolve_range;
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;
use crate::domain::table_row_iter::{OrderedRowIter, RowIter};
use crate::domain::table_trait::TableTrait;

/// Rows sit at consecutive physical indices, so user order is storage order.
#[derive(Debug)]
pub struct OrderedTable {
    columns: Vec<Box<dyn Column>>,
    /// Set once a column is reserved for child links.
    child_column: Option<usize>,
}

impl OrderedTable {
    pub fn new() -> Self { OrderedTable { columns: Vec::new(), child_column: None } }

    fn column(&self, col: usize) -> DomainResult<&dyn Column> {
        self.columns
            .get(col)
            .map(|boxed| boxed.as_ref())
            .ok_or(DomainError::IndexOutOfBounds {
                index: col,
                len: self.columns.len(),
            })
    }

    /// Brings every column up to `len`, so a positional edit shifts all of a row
    /// together. Columns can otherwise differ in length, since `update_row` pads
    /// only the columns it touches.
    fn pad_to(&mut self, len: usize) {
        for col in self.columns.iter_mut() {
            while col.len() < len {
                col.push_empty();
            }
        }
    }

    /// Validated up front, so a refused row leaves the table unchanged.
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
}

impl TableTrait for OrderedTable {
    type Rows<'a> = OrderedRowIter<'a>;

    fn add_column<C: Column + 'static>(&mut self, col: C) { self.columns.push(Box::new(col)) }

    fn set_child_cell(&mut self, row: usize, col: usize, link: ChildLink) -> DomainResult<()> {
        let nrows = self.nrows();
        if row >= nrows {
            return Err(DomainError::IndexOutOfBounds { index: row, len: nrows });
        }
        let column = self
            .columns
            .get_mut(col)
            .ok_or(DomainError::IndexOutOfBounds { index: col, len: 0 })?;
        while row >= column.len() {
            column.push_empty();
        }
        column.update(row, Value::Child(link))
    }

    fn child_column(&self) -> Option<usize> {
        self.child_column
    }

    fn set_child_column(&mut self, col: usize) -> DomainResult<()> {
        let column = self.column(col)?;
        // Only a `Child` column can hold links, so anything else is a mistake
        // rather than something to coerce.
        if column.accepts(&Value::Child(ChildLink::EMPTY)).is_err() {
            return Err(DomainError::NotAChildColumn { column: col });
        }
        self.child_column = Some(col);
        Ok(())
    }

    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        self.guard_child_values(&row)?;
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            col.push(val)?;
        }
        Ok(())
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        self.guard_child_row(idx)?;
        self.guard_child_values(&row)?;
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while idx >= col.len() { col.push_empty(); }
            col.update(idx, val)?;
        }
        Ok(())
    }

    fn print_table(&self) -> DomainResult<()> {
        if self.columns.is_empty() {
            println!("(empty table)");
            return Ok(());
        }
        let nrows = self.nrows();
        let mut widths = Vec::new();
        for col in &self.columns {
            let mut max_width = col.name().len();
            for r in 0..nrows {
                if r < col.len() {
                    let val = col.get_value(r)?;
                    if val.len() > max_width { max_width = val.len(); }
                }
            }
            widths.push(max_width);
        }
        for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() { if i>0 {print!(" ")}; print!("{:<width$}", col.name(), width=w); }
        println!();
        for (i, w) in widths.iter().enumerate() { if i>0 {print!(" ")}; print!("{}", "-".repeat(*w)); }
        println!();
        for r in 0..nrows {
            for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() {
                if i>0 { print!(" "); }
                let val = if r < col.len() { col.get_value(r)? } else { String::new() };
                print!("{:<width$}", val, width=w);
            }
            println!();
        }
        Ok(())
    }

    /// The longest column, since a row is only accepted with the full arity.
    fn nrows(&self) -> usize {
        self.columns.iter().map(|c| c.len()).max().unwrap_or(0)
    }

    /// Rows sit at consecutive indices, so the walk is a plain range.
    fn iter_rows(&self) -> Self::Rows<'_> {
        RowIter::new(&self.columns, 0..self.nrows())
    }

    fn row_range<R: RangeBounds<usize>>(&self, range: R) -> DomainResult<Self::Rows<'_>> {
        let range = resolve_range(range, self.nrows())?;
        Ok(RowIter::new(&self.columns, range))
    }

    fn insert_row_at(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        self.guard_child_values(&row)?;
        let nrows = self.nrows();
        if idx > nrows {
            return Err(DomainError::IndexOutOfBounds { index: idx, len: nrows });
        }
        // Columns are padded to equal length first, so the shift lands every cell
        // of the row at the same index.
        self.pad_to(nrows);
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            col.insert(idx, val)?;
        }
        Ok(())
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
        self.column(col)?.get(row)
    }

    fn cell_display(&self, row: usize, col: usize) -> DomainResult<String> {
        self.column(col)?.get_value(row)
    }

    fn iter_column(&self, col: usize) -> DomainResult<impl Iterator<Item = DomainResult<Value>>> {
        let column = self.column(col)?;
        Ok((0..self.nrows()).map(move |row| column.get(row)))
    }

    fn update_cell(&mut self, row: usize, col: usize, val: Value) -> DomainResult<()> {
        self.guard_child_column(col)?;
        let nrows = self.nrows();
        if row >= nrows {
            return Err(DomainError::IndexOutOfBounds { index: row, len: nrows });
        }
        let ncols = self.columns.len();
        let column = self
            .columns
            .get_mut(col)
            .ok_or(DomainError::IndexOutOfBounds { index: col, len: ncols })?;
        column.accepts(&val)?;
        while row >= column.len() {
            column.push_empty();
        }
        column.update(row, val)
    }

    fn swap_rows_at(&mut self, first: usize, second: usize) -> DomainResult<()> {
        let nrows = self.nrows();
        for idx in [first, second] {
            if idx >= nrows {
                return Err(DomainError::IndexOutOfBounds { index: idx, len: nrows });
            }
        }
        if first == second {
            return Ok(());
        }
        self.pad_to(nrows);
        for col in self.columns.iter_mut() {
            col.swap(first, second)?;
        }
        Ok(())
    }

    fn remove_row(&mut self, idx: usize) -> DomainResult<Vec<Value>> {
        self.guard_child_row(idx)?;
        let nrows = self.nrows();
        if idx >= nrows {
            return Err(DomainError::IndexOutOfBounds { index: idx, len: nrows });
        }
        self.pad_to(nrows);
        let mut removed = Vec::with_capacity(self.columns.len());
        for col in self.columns.iter_mut() {
            removed.push(col.remove(idx)?);
        }
        Ok(removed)
    }

    fn remove_row_range<R: RangeBounds<usize>>(
        &mut self,
        range: R,
    ) -> DomainResult<Vec<Vec<Value>>> {
        let range = resolve_range(range, self.nrows())?;
        let mut removed = Vec::with_capacity(range.len());
        // Always removing at `start` walks the range as earlier rows shift down.
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
        Ok(())
    }
}
