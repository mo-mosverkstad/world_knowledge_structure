use std::collections::HashSet;
use std::fmt::Debug;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;
use crate::domain::table_trait::TableTrait;
use crate::domain::treearray::TreeArray;

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

    pub fn get_logical_order(&self) -> TreeArray<usize> {
        self.logical_order.clone()
    }

    pub fn get_next_physical_index(&self) -> usize {
        self.next_physical_index
    }

    pub fn get_free_physical(&self) -> HashSet<usize> {
        self.free_physical.clone()
    }

    /// Rejects a row whose arity or value types do not match the columns, before
    /// any slot is allocated or mutated.
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

    /// Reuses a freed physical slot when available, otherwise hands out the next
    /// one. Errors instead of overflowing once `usize` is exhausted.
    fn allocate_physical_index(&mut self) -> DomainResult<usize> {
        if let Some(&p) = self.free_physical.iter().next() {
            self.free_physical.remove(&p);
            return Ok(p);
        }
        let p = self.next_physical_index;
        self.next_physical_index = p
            .checked_add(1)
            .ok_or(DomainError::CapacityExceeded)?;
        Ok(p)
    }

    /// Delete a row by user index (mark physical slot as free)
    pub fn delete_row(&mut self, user_idx: usize) -> DomainResult<()> {
        let phys = self.logical_order.try_get(user_idx)?;
        self.logical_order.delete(user_idx)?;
        self.free_physical.insert(phys);
        Ok(())
    }

    /// Insert a row at user index (shifts subsequent)
    pub fn insert_row(&mut self, user_idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
        if user_idx > self.logical_order.len() {
            return Err(DomainError::IndexOutOfBounds {
                index: user_idx,
                len: self.logical_order.len(),
            });
        }

        let phys_idx = self.allocate_physical_index()?;

        // ensure each column has space for phys_idx and set the value at phys_idx
        for (val, col) in row.into_iter().zip(self.columns.iter_mut()) {
            while phys_idx >= col.len() {
                col.push_empty();
            }
            col.update(phys_idx, val)?;
        }

        // insert into logical array at user_idx
        self.logical_order.insert(user_idx, phys_idx)
    }

    /// Rearrange user indices: swap two rows (swap physical indices)
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

    /// Get number of logical rows
    pub fn nrows(&self) -> usize {
        self.logical_order.len()
    }
}

impl TableTrait for UnorderedTable {
    fn add_column<C: Column + 'static>(&mut self, col: C) { self.columns.push(Box::new(col)) }

    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()> {
        let idx = self.logical_order.len();
        self.insert_row(idx, row)
    }

    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
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
        let nrows = self.logical_order.len();
        let mut widths = Vec::new();
        for col in &self.columns {
            let mut max_width = col.name().len();
            for user_idx in 0..nrows {
                let phys_idx = self.logical_order.try_get(user_idx)?;
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
        for user_idx in 0..nrows {
            let phys_idx = self.logical_order.try_get(user_idx)?;
            for (i, (col, w)) in self.columns.iter().zip(&widths).enumerate() {
                if i>0 { print!(" "); }
                print!("{:<width$}", col.get_value(phys_idx)?, width=w);
            }
            println!();
        }
        Ok(())
    }
}
