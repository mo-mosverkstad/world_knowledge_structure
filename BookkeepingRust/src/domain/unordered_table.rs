use std::fmt::Debug;
use std::ops::RangeBounds;

use crate::data_structures::slot_allocator::SlotAllocator;
use crate::data_structures::treearray::TreeArray;
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
}

#[allow(dead_code)]
impl UnorderedTable {
    pub fn new() -> Self {
        Self {
            columns: Vec::new(),
            logical_order: TreeArray::<usize>::new(),
            slots: SlotAllocator::new(),
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
        let phys = self.logical_order.try_get(user_idx)?;
        self.logical_order.delete(user_idx)?;
        self.slots.free(phys)?;
        Ok(())
    }

    /// Shifts subsequent rows up.
    pub fn insert_row(&mut self, user_idx: usize, row: Vec<Value>) -> DomainResult<()> {
        self.validate_row(&row)?;
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
}
