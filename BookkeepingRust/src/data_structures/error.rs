use std::error::Error;
use std::fmt;

/// Failures reported by the data structures, independent of the other layers so
/// that nothing here depends on `domain`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StructureError {
    /// An index was outside the valid range `0..len`.
    IndexOutOfBounds { index: usize, len: usize },
    /// A range whose start is after its end; both bounds may be individually valid.
    InvalidRange { start: usize, end: usize },
    /// No more indices can be handed out.
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

pub type StructureResult<T> = Result<T, StructureError>;
