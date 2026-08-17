use std::fmt::Debug;

use crate::core::table_column::Column;
use crate::core::table_column::Value;

pub trait TableTrait: Debug {
    fn add_column<C: Column + 'static>(&mut self, col: C);
    fn append_row(&mut self, row: Vec<Value>);
    fn update_row(&mut self, idx: usize, row: Vec<Value>);
    fn print_table(&self);
}