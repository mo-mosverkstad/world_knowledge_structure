//! Tests for `statemanager::history`.

use bookkeeping_rust::statemanager::error::StatemanagerError;
use bookkeeping_rust::statemanager::history::{History, TargetMementoTrait};

/// Minimal target: a single value whose previous state is the whole memento.
struct NumberStore {
    value: i32,
}

impl TargetMementoTrait<i32> for NumberStore {
    fn apply_memento(&mut self, memento: &i32) -> i32 {
        let old_value = self.value;
        self.value = *memento;
        old_value
    }
}

#[test]
fn undo_and_redo_walk_the_recorded_states() {
    let mut store = NumberStore { value: 10 };
    let mut history = History::<i32>::new();

    history.record(store.value);
    store.value = 20;
    history.record(store.value);
    store.value = 30;

    history.undo(&mut store).expect("one change is recorded");
    assert_eq!(store.value, 20);
    history.undo(&mut store).expect("two changes are recorded");
    assert_eq!(store.value, 10);

    history.redo(&mut store).expect("one change was undone");
    assert_eq!(store.value, 20);
    history.redo(&mut store).expect("two changes were undone");
    assert_eq!(store.value, 30);
}

#[test]
fn exhausted_stacks_are_reported_instead_of_silently_ignored() {
    let mut store = NumberStore { value: 1 };
    let mut history = History::<i32>::new();

    assert_eq!(
        history.undo(&mut store),
        Err(StatemanagerError::NothingToUndo)
    );
    assert_eq!(
        history.redo(&mut store),
        Err(StatemanagerError::NothingToRedo)
    );
    // A rejected undo/redo leaves the target untouched.
    assert_eq!(store.value, 1);
}

#[test]
fn recording_a_change_discards_the_redo_stack() {
    let mut store = NumberStore { value: 0 };
    let mut history = History::<i32>::new();

    history.record(store.value);
    store.value = 5;
    history.undo(&mut store).expect("one change is recorded");
    assert!(history.redoable());

    // A fresh change invalidates the previously undone branch.
    history.record(store.value);
    assert!(!history.redoable());
    assert_eq!(
        history.redo(&mut store),
        Err(StatemanagerError::NothingToRedo)
    );
}

#[test]
fn clear_empties_both_stacks() {
    let mut store = NumberStore { value: 0 };
    let mut history = History::<i32>::new();

    history.record(store.value);
    store.value = 9;
    assert_eq!(store.value, 9);
    assert!(history.undoable());

    history.clear();
    assert!(!history.undoable());
    assert!(!history.redoable());
}
