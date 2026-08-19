use std::error::Error;
use std::fmt;

/// Every fallible domain operation reports failures through this type, so the
/// caller (ultimately `main`) decides how to react. The domain layer never
/// panics on invalid input.
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
    /// A range was given with its start after its end. Both bounds are in
    /// bounds individually; the range itself is not well formed.
    InvalidRange { start: usize, end: usize },
    /// No more physical slots can be handed out (index counter would overflow).
    CapacityExceeded,
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
