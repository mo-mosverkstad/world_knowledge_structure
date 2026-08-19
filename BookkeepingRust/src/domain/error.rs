use std::error::Error;
use std::fmt;

use crate::data_structures::error::StructureError;

/// Failures from the domain layer, which never panics on invalid input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainError {
    /// A row was supplied with a different number of values than the table has columns.
    RowLengthMismatch { expected: usize, actual: usize },
    /// A `Value` variant did not match the column it was written to.
    ColumnTypeMismatch {
        column: String,
        expected: &'static str,
        actual: &'static str,
    },
    /// An index was outside the valid range `0..len`.
    IndexOutOfBounds { index: usize, len: usize },
    /// A range whose start is after its end; both bounds may be individually valid.
    InvalidRange { start: usize, end: usize },
    /// No more physical slots can be handed out (index counter would overflow).
    CapacityExceeded,
    /// A cell was given no segments; a cell always holds at least one.
    EmptyCell,
    /// The last remaining segment of a cell cannot be removed.
    LastSegment { column: String },
}

/// Lets `?` on a data-structure operation produce a `DomainError` without an
/// explicit `map_err`.
impl From<StructureError> for DomainError {
    fn from(err: StructureError) -> Self {
        match err {
            StructureError::IndexOutOfBounds { index, len } => {
                DomainError::IndexOutOfBounds { index, len }
            }
            StructureError::InvalidRange { start, end } => {
                DomainError::InvalidRange { start, end }
            }
            StructureError::CapacityExceeded => DomainError::CapacityExceeded,
        }
    }
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DomainError::RowLengthMismatch { expected, actual } => write!(
                f,
                "row length mismatch: table has {expected} column(s), got {actual} value(s)"
            ),
            DomainError::ColumnTypeMismatch {
                column,
                expected,
                actual,
            } => write!(
                f,
                "type mismatch for column '{column}': expected {expected}, got {actual}"
            ),
            DomainError::EmptyCell => {
                write!(f, "a cell must have at least one segment, got none")
            }
            DomainError::LastSegment { column } => write!(
                f,
                "cannot remove the last segment of a cell in column '{column}'"
            ),
            DomainError::IndexOutOfBounds { index, len } => {
                write!(f, "index {index} is out of bounds (length {len})")
            }
            DomainError::InvalidRange { start, end } => {
                write!(f, "invalid range {start}..{end}: start is after end")
            }
            DomainError::CapacityExceeded => {
                write!(f, "capacity exceeded: no further indices can be allocated")
            }
        }
    }
}

impl Error for DomainError {}

/// Shorthand for results produced by the domain layer.
pub type DomainResult<T> = Result<T, DomainError>;
