/*
mod statemanager;

use statemanager::history::TargetMementoTrait;
use statemanager::history::History;

struct NumberStore {
    value: i32,
}

impl TargetMementoTrait<i32> for NumberStore {
    fn apply_memento(&mut self, memento: &i32) -> i32 {
        let old_value = self.value;
        self.value = *memento; // Replace the current value with the memento
        old_value // Return what we replaced
    }
}

fn main() {
    let mut store = NumberStore { value: 10 };
    let mut history = History::<i32>::new();

    println!("Initial value: {}", store.value);

    // Change 10 -> 20.
    // Store 10 as the memento needed to undo this change.
    let old_value = store.value;
    store.value = 20;
    history.record(old_value);

    println!("After change: {}", store.value);

    // Change 20 -> 30.
    // Store 20 as the memento needed to undo this change.
    let old_value = store.value;
    store.value = 30;
    history.record(old_value);

    println!("After second change: {}", store.value);

    // Undo 30 -> 20.
    history.undo(&mut store);

    println!("After undo: {}", store.value);

    // Undo 20 -> 10.
    history.undo(&mut store);

    println!("After second undo: {}", store.value);

    // Redo 10 -> 20.
    history.redo(&mut store);

    println!("After redo: {}", store.value);

    // Redo 20 -> 30.
    history.redo(&mut store);

    println!("After second redo: {}", store.value);
}
    */

mod demos;
mod domain;

use demos::tree_array_demo::tree_array_demo;
use demos::table_demo::table_demo;
// use demos::tree_array_demo::tree_array_demo;

fn main() {
    tree_array_demo();
    table_demo();
}