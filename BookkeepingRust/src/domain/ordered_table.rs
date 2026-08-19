use std::fmt::Debug;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;
use crate::domain::table_rows::{OrderedRowIter, RowIter, validate_range};
use crate::domain::table_trait::TableTrait;

// ----------------------------- Table traits & OrderedTable -----------------------------
#[derive(Debug)]
pub struct OrderedTable {
    columns: Vec<Box<dyn Column>>,
}

impl OrderedTable {
    pub fn new() -> Self { OrderedTable { columns: Vec::new() } }

    /// Rejects a row whose arity or value types do not match the columns.
    /// Validating up front keeps the table consistent when a row is refused.
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

    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            col.push(val)?;
        }
        Ok(())
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
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

    /// Every column holds one slot per row, because a row is only ever accepted
    /// with the full column arity, so the longest column is the row count.
    fn nrows(&self) -> usize {
        self.columns.iter().map(|c| c.len()).max().unwrap_or(0)
    }

    /// Rows sit at consecutive physical indices here, so the walk is a plain
    /// range and each row costs `O(columns)`.
    fn iter_rows(&self) -> Self::Rows<'_> {
        self.rows_from(0)
    }

    fn rows_from(&self, start: usize) -> Self::Rows<'_> {
        let nrows = self.nrows();
        // `start.min(nrows)` keeps the range well formed, so an out-of-range
        // start simply yields nothing.
        RowIter::new(&self.columns, start.min(nrows)..nrows)
    }

    fn row_range(&self, index: usize, count: usize) -> DomainResult<Self::Rows<'_>> {
        validate_range(index, count, self.nrows())?;
        Ok(RowIter::new(&self.columns, index..index + count))
    }
}
