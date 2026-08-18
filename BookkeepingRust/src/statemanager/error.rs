use std::error::Error;
use std::fmt;

/// Failures reported by the state manager layer. This type is deliberately
/// independent of the domain layer: `statemanager` knows nothing about tables,
/// columns or trees, and the domain layer knows nothing about histories. Only
/// code that combines both layers has to deal with both error types.
#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(dead_code)]
pub enum StatemanagerError {
    /// An undo was requested while the undo stack was empty.
    NothingToUndo,
    /// A redo was requested while the redo stack was empty.
    NothingToRedo,
}

impl fmt::Display for StatemanagerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StatemanagerError::NothingToUndo => write!(f, "nothing to undo: undo stack is empty"),
            StatemanagerError::NothingToRedo => write!(f, "nothing to redo: redo stack is empty"),
        }
    }
}

impl Error for StatemanagerError {}

/// Shorthand for results produced by the state manager layer.
pub type StatemanagerResult<T> = Result<T, StatemanagerError>;
