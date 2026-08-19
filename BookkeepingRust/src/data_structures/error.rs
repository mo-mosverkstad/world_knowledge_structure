use std::error::Error;
use std::fmt;

/// Failures reported by the general-purpose data structures.
///
/// This type is deliberately independent of the other layers, in the same way
/// [`StatemanagerError`](crate::statemanager::error::StatemanagerError) is: the
/// structures in this module know nothing about tables, columns or undo/redo, so
/// they cannot report a business-rule failure and must not depend on a type that
/// can describe one.
///
/// The variants are exactly the ways an indexed container can be *asked for*
/// something it cannot provide. Whether that is acceptable is the caller's
/// business — the domain layer converts these into
/// [`DomainError`](crate::domain::error::DomainError) via `From`, so a `?` in
/// domain code keeps working unchanged.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StructureError {
    /// An index was outside the valid range `0..len`.
    IndexOutOfBounds { index: usize, len: usize },
    /// A range was given with its start after its end. Both bounds are in
    /// bounds individually; the range itself is not well formed.
    InvalidRange { start: usize, end: usize },
    /// No more indices can be handed out (the index counter would overflow).
    CapacityExceeded,
}

impl fmt::Display for StructureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            StructureError::IndexOutOfBounds { index, len } => {
                write!(f, "index {index} is out of bounds (length {len})")
            }
            StructureError::InvalidRange { start, end } => {
                write!(f, "invalid range {start}..{end}: start is after end")
            }
            StructureError::CapacityExceeded => {
                write!(f, "capacity exceeded: no further indices can be allocated")
            }
        }
    }
}

impl Error for StructureError {}

/// Shorthand for results produced by the data structures.
pub type StructureResult<T> = Result<T, StructureError>;
