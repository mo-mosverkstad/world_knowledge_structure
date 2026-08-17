use std::fmt::Debug;

use crate::domain::table_trait::TableTrait;
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;

// ----------------------------- Table traits & OrderedTable (unchanged) -----------------------------
#[derive(Debug)]
pub struct OrderedTable {
    columns: Vec<Box<dyn Column>>,
}

impl OrderedTable {
    pub fn new() -> Self { OrderedTable { columns: Vec::new() } }
}

impl TableTrait for OrderedTable {
    fn add_column<C: Column + 'static>(&mut self, col: C) { self.columns.push(Box::new(col)) }

    fn append_row(&mut self, row: Vec<Value>) {
        assert_eq!(row.len(), self.columns.len(), "Row length mismatch");
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            col.push(val);
        }
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) {
        assert_eq!(row.len(), self.columns.len(), "Row length mismatch");
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while idx >= col.len() { col.push_empty(); }
            col.update(idx, val);
        }
    }

    fn print_table(&self) {
        if self.columns.is_empty() { println!("(empty table)"); return; }
        let nrows = self.columns.iter().map(|c| c.len()).max().unwrap_or(0);
        let mut widths = Vec::new();
        for col in &self.columns {
            let mut max_width = col.name().len();
            for r in 0..nrows { let val = col.get_value(r); if val.len() > max_width { max_width = val.len(); } }
            widths.push(max_width);
        }
        for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() { if i>0 {print!(" ")}; print!("{:<width$}", col.name(), width=w); }
        println!();
        for (i, w) in widths.iter().enumerate() { if i>0 {print!(" ")}; print!("{}", "-".repeat(*w)); }
        println!();
        for r in 0..nrows {
            for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() {
                if i>0 { print!(" "); }
                let val = if r < col.len() { col.get_value(r) } else { "".to_string() };
                print!("{:<width$}", val, width=w);
            }
            println!();
        }
    }
}