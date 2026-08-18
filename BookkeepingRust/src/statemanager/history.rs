use crate::statemanager::error::{StatemanagerError, StatemanagerResult};

pub trait TargetMementoTrait<T> {
    fn apply_memento(self: &mut Self, memento: &T) -> T;
}

#[derive(Debug, Default)]
pub struct History<T: Clone> {
    undo_stack: Vec<T>,
    redo_stack: Vec<T>,
}

#[allow(unused_assignments, dead_code)]
impl<T: Clone> History<T> {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    pub fn record(self: &mut Self, memento: T) {
        self.undo_stack.push(memento);
        self.redo_stack.clear();
    }

    pub fn undoable(self: &mut Self) -> bool {
        self.undo_stack.len() != 0
    }

    pub fn redoable(self: &mut Self) -> bool {
        self.redo_stack.len() != 0
    }

    /// Undoes the most recently recorded change. An empty undo stack is a
    /// reportable failure (`StatemanagerError::NothingToUndo`) rather than a
    /// silent no-op, so callers can decide how to react.
    pub fn undo<U: TargetMementoTrait<T>>(
        self: &mut Self,
        target: &mut U,
    ) -> StatemanagerResult<()> {
        let memento = self
            .undo_stack
            .pop()
            .ok_or(StatemanagerError::NothingToUndo)?;
        let inverse = target.apply_memento(&memento);
        self.redo_stack.push(inverse);
        Ok(())
    }

    /// Reapplies the most recently undone change. Fails with
    /// `StatemanagerError::NothingToRedo` when the redo stack is empty.
    pub fn redo<U: TargetMementoTrait<T>>(
        self: &mut Self,
        target: &mut U,
    ) -> StatemanagerResult<()> {
        let memento = self
            .redo_stack
            .pop()
            .ok_or(StatemanagerError::NothingToRedo)?;
        let inverse = target.apply_memento(&memento);
        self.undo_stack.push(inverse);
        Ok(())
    }

    pub fn clear(self: &mut Self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}
