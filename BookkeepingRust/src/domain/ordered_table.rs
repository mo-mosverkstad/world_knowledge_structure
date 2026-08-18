use std::fmt::Debug;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;
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
        let nrows = self.columns.iter().map(|c| c.len()).max().unwrap_or(0);
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
}
