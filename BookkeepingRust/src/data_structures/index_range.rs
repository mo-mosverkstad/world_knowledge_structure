//! Resolution of caller-supplied ranges into a validated half-open interval.
//!
//! Every indexed collection here (and, through them, the domain layer's tables)
//! accepts ranges in the same form and rejects them with the same errors, so the
//! rules live here once rather than being restated per collection:
//!
//! * any Rust range syntax is accepted — `..`, `a..`, `..b`, `..=b`, `a..b`,
//!   `a..=b` — so the caller does not have to remember whether a method wants
//!   `(start, count)`, `(start, end)`, or something else;
//! * a range is validated up front, so an out-of-bounds request is reported
//!   before any element is produced rather than surfacing mid-iteration;
//! * an omitted bound means "from the beginning" / "to the end" and can never
//!   itself be out of bounds, so `..` is always valid, including on an empty
//!   collection.

use std::ops::{Bound, Range, RangeBounds};

use crate::data_structures::error::{StructureError, StructureResult};

/// Normalises `range` into a half-open `start..end` and checks it against a
/// collection of `len` elements.
///
/// Checks run in this order, which mirrors how slice indexing reports the same
/// mistakes:
///
/// 1. `start > end` is [`StructureError::InvalidRange`] — the range is not well
///    formed, which is a distinct mistake from asking for something past the end,
///    and stays the diagnosis even when the bounds are also out of bounds. This
///    applies only when the caller actually supplied an end; an omitted one
///    cannot contradict the start.
/// 2. `start > len` is [`StructureError::IndexOutOfBounds`] reporting `start`, the
///    value the caller supplied;
/// 3. `end > len` is [`StructureError::IndexOutOfBounds`] reporting `len`, the first
///    index that does not exist. The end is exclusive, so `..end` never names
///    that index and echoing the caller's bound back would be misleading.
///
/// `start == len` is accepted for an empty range, i.e. the position just past the
/// last element, matching how the insert operations treat `len` as a valid
/// position. So `len..` and `len..len` are empty, not errors.
pub fn resolve_range<R: RangeBounds<usize>>(range: R, len: usize) -> StructureResult<Range<usize>> {
    // `saturating_add` cannot mask a real request: a collection can never hold
    // `usize::MAX + 1` elements, so a bound that saturates is out of bounds and
    // is caught by the checks below.
    let start = match range.start_bound() {
        Bound::Included(&n) => n,
        Bound::Excluded(&n) => n.saturating_add(1),
        Bound::Unbounded => 0,
    };
    // Kept optional rather than defaulted to `len` up front, so that an omitted
    // end is not mistaken for one the caller chose: `len + 1..` has to be
    // reported as an out-of-bounds start, not as a backwards range.
    let end = match range.end_bound() {
        Bound::Included(&n) => Some(n.saturating_add(1)),
        Bound::Excluded(&n) => Some(n),
        Bound::Unbounded => None,
    };

    if let Some(end) = end
        && start > end
    {
        return Err(StructureError::InvalidRange { start, end });
    }
    if start > len {
        return Err(StructureError::IndexOutOfBounds { index: start, len });
    }
    let end = end.unwrap_or(len);
    if end > len {
        return Err(StructureError::IndexOutOfBounds { index: len, len });
    }
    Ok(start..end)
}
