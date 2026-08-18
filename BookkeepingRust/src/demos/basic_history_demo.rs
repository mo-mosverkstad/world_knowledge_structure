use crate::statemanager::error::StatemanagerResult;
use crate::statemanager::history::History;
use crate::statemanager::history::TargetMementoTrait;

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

pub fn basic_history_demo() -> StatemanagerResult<()> {
    println!(" ------------------------------- Basic History Demo ------------------------------- ");
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

    // Undo 30 -> 20. Both mementos are on the undo stack, so these succeed and
    // the `?` never fires.
    history.undo(&mut store)?;

    println!("After undo: {}", store.value);

    // Undo 20 -> 10.
    history.undo(&mut store)?;

    println!("After second undo: {}", store.value);

    // The undo stack is now empty, so a third undo is an error. Handle it here
    // instead of propagating, so the demo can show the failure and carry on.
    match history.undo(&mut store) {
        Ok(()) => println!("Unexpected: third undo succeeded"),
        Err(err) => println!("Rejected third undo: {err}"),
    }

    // Redo 10 -> 20.
    history.redo(&mut store)?;

    println!("After redo: {}", store.value);

    // Redo 20 -> 30.
    history.redo(&mut store)?;

    println!("After second redo: {}", store.value);

    // Symmetrically, the redo stack is now drained.
    match history.redo(&mut store) {
        Ok(()) => println!("Unexpected: third redo succeeded"),
        Err(err) => println!("Rejected third redo: {err}"),
    }

    println!(" ------------------------------------------------------------------------------- \n");
    Ok(())
}
