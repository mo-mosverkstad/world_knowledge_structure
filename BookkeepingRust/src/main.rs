mod core;

use core::treearray::TreeArray;
use core::table_column::Column;
use core::table_column::TableColumn;
use core::table_column::Value;

/*
fn main() {
    let mut t = TreeArray::<u8>::new();
    t.append(3);
    t.append(55);
    t.append(77);
    t.append(33);
    t.append(23);
    t.append(120);
    t.append(73);
    t.append(54);
    t.append(67);
    t.append(220);
    t.append(232);
    println!("Array: {:?}", t.in_order());

    let x = 58;
    let my_ref = &x;
    println!("my_ref = {:p}, *my_ref = {}", my_ref, *my_ref);
}
*/

use std::fmt::Debug;
use std::collections::{HashSet};

// ----------------------------- Table traits & OrderedTable (unchanged) -----------------------------
trait TableTrait: Debug {
    fn add_column<C: Column + 'static>(&mut self, col: C);
    fn append_row(&mut self, row: Vec<Value>);
    fn update_row(&mut self, idx: usize, row: Vec<Value>);
    fn print_table(&self);
}

#[derive(Debug)]
struct OrderedTable {
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

// ----------------------------- UnorderedTable with TreeArray + recycling -----------------------------
#[derive(Debug)]
struct UnorderedTable {
    columns: Vec<Box<dyn Column>>,
    logical_order: TreeArray<usize>, // user_index -> physical_index
    next_physical_index: usize,
    free_physical: HashSet<usize>, // recycling of freed physical indices
}

impl UnorderedTable {
    pub fn new() -> Self {
        Self {
            columns: Vec::new(),
            logical_order: TreeArray::new(),
            next_physical_index: 0,
            free_physical: HashSet::new(),
        }
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

// ----------------------------- Demonstration in main -----------------------------
fn main() {
    // Ordered example
    let mut ord = OrderedTable::new();
    ord.add_column(TableColumn::<i32>::new("Age"));
    ord.add_column(TableColumn::<String>::new("Name"));
    ord.add_column(TableColumn::<f32>::new("Salary"));
    ord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)]);
    ord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)]);
    println!("OrderedTable:");
    ord.print_table();

    // Unordered example using TreeArray + recycling
    let mut unord = UnorderedTable::new();
    unord.add_column(TableColumn::<i32>::new("Age"));
    unord.add_column(TableColumn::<String>::new("Name"));
    unord.add_column(TableColumn::<f32>::new("Salary"));

    // append two rows
    unord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)]);
    unord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)]);
    println!("\nUnorderedTable after appends:");
    unord.print_table();

    // insert at logical index 1
    unord.insert_row(1, vec![Value::Int(22), Value::Str("Elina".to_string()), Value::Float(59929.0)]);
    println!("\nAfter insert at logical idx 1:");
    unord.print_table();

    // delete logical index 0 -> frees a physical slot
    unord.delete_row(0);
    println!("\nAfter delete logical idx 0 (frees physical slot):");
    unord.print_table();
    println!("Next physical index: {}", unord.next_physical_index);
    println!("Free physical set: {:?}", unord.free_physical);

    // insert again (should reuse freed physical index)
    unord.insert_row(1, vec![Value::Int(27), Value::Str("Sam".to_string()), Value::Float(48000.0)]);
    println!("\nAfter insert at logical idx 0 (should reuse freed physical slot):");
    unord.print_table();
    println!("Next physical index: {}", unord.next_physical_index);
    println!("Free physical set: {:?}", unord.free_physical);

    // swap rows 0 and 2
    unord.swap_rows(0, 2);
    println!("\nAfter swap rows 0 and 2:");
    unord.print_table();

    // update row
    unord.update_row(1, vec![Value::Int(99), Value::Str("Updated".to_string()), Value::Float(12345.0)]);
    println!("\nAfter update logical row 1:");
    unord.print_table();

    // show internal mapping & recycling info
    println!("\nInternal logical->physical (in-order): {:?}", unord.logical_order.in_order());
    println!("Next physical index: {}", unord.next_physical_index);
    println!("Free physical set: {:?}", unord.free_physical);
}
