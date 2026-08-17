use std::fmt::Debug;
use std::collections::{HashSet};

use crate::domain::treearray::TreeArray;
use crate::domain::table_trait::TableTrait;
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;

// ----------------------------- UnorderedTable with TreeArray + recycling -----------------------------
#[derive(Debug)]
pub struct UnorderedTable {
    columns: Vec<Box<dyn Column>>,
    logical_order: TreeArray<usize>, // user_index -> physical_index
    next_physical_index: usize,
    free_physical: HashSet<usize>, // recycling of freed physical indices
}

#[allow(dead_code)]
impl UnorderedTable {
    pub fn new() -> Self {
        Self {
            columns: Vec::new(),
            logical_order: TreeArray::<usize>::new(),
            next_physical_index: 0usize,
            free_physical: HashSet::<usize>::new(),
        }
    }

    pub fn get_logical_order(&self) -> TreeArray<usize>{
        self.logical_order.clone()
    }

    pub fn get_next_physical_index(&self) -> usize{
        self.next_physical_index.clone()
    }

    pub fn get_free_physical(&self) -> HashSet<usize>{
        self.free_physical.clone()
    }

    /// Delete a row by user index (mark physical slot as free)
    pub fn delete_row(&mut self, user_idx: usize) {
        if let Some(phys) = self.logical_order.get(user_idx) {
            // remove logical mapping
            self.logical_order.delete(user_idx);
            // add to free set for reuse
            self.free_physical.insert(phys);
        }
    }

    /// Insert a row at user index (shifts subsequent)
    pub fn insert_row(&mut self, user_idx: usize, row: Vec<Value>) {
        assert_eq!(row.len(), self.columns.len(), "Row length mismatch");
        // choose physical index: recycle or append
        let phys_idx = if let Some(&p) = self.free_physical.iter().next() {
            // take an arbitrary element from the set
            self.free_physical.take(&p);
            p
        } else {
            let p = self.next_physical_index;
            self.next_physical_index += 1;
            p
        };

        // ensure each column has space for phys_idx and set the value at phys_idx
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while phys_idx >= col.len() {
                col.push_empty();
            }
            col.update(phys_idx, val);
        }

        // insert into logical array at user_idx
        self.logical_order.insert(user_idx, phys_idx);
    }

    /// Rearrange user indices: swap two rows (swap physical indices)
    pub fn swap_rows(&mut self, idx1: usize, idx2: usize) {
        if idx1 == idx2 { return; }
        if let (Some(p1), Some(p2)) = (self.logical_order.get(idx1), self.logical_order.get(idx2)) {
            self.logical_order.set(idx1, p2);
            self.logical_order.set(idx2, p1);
        }
    }

    /// Get number of logical rows
    pub fn nrows(&self) -> usize { self.logical_order.len() }
}

impl TableTrait for UnorderedTable {
    fn add_column<C: Column + 'static>(&mut self, col: C) { self.columns.push(Box::new(col)) }

    fn append_row(&mut self, row: Vec<Value>) {
        let idx = self.logical_order.len();
        self.insert_row(idx, row);
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) {
        assert_eq!(row.len(), self.columns.len(), "Row length mismatch");
        if let Some(phys_idx) = self.logical_order.get(idx) {
            for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
                while phys_idx >= col.len() { col.push_empty(); }
                col.update(phys_idx, val);
            }
        }
    }

    fn print_table(&self) {
        if self.columns.is_empty() || self.logical_order.len() == 0 { println!("(empty table)"); return; }
        let nrows = self.logical_order.len();
        let mut widths = Vec::new();
        for col in &self.columns {
            let mut max_width = col.name().len();
            for user_idx in 0..nrows {
                if let Some(phys_idx) = self.logical_order.get(user_idx) {
                    let val = col.get_value(phys_idx);
                    if val.len() > max_width { max_width = val.len(); }
                }
            }
            widths.push(max_width);
        }
        // header
        for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() { if i>0 {print!(" ")}; print!("{:<width$}", col.name(), width=w); }
        println!();
        for (i, w) in widths.iter().enumerate() { if i>0 {print!(" ")}; print!("{}", "-".repeat(*w)); }
        println!();
        // rows
        for user_idx in 0..nrows {
            if let Some(phys_idx) = self.logical_order.get(user_idx) {
                for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() {
                    if i>0 { print!(" "); }
                    print!("{:<width$}", col.get_value(phys_idx), width=w);
                }
                println!();
            }
        }
    }
}