//! Resolution of caller-supplied ranges into a validated half-open interval.

use std::ops::{Bound, Range, RangeBounds};

use crate::data_structures::error::{StructureError, StructureResult};

/// Normalises any Rust range syntax into `start..end` and checks it against a
/// collection of `len` elements.
///
/// A backwards range is [`StructureError::InvalidRange`], checked first so it wins
/// over out-of-bounds bounds. An out-of-bounds start reports the caller's index; an
/// out-of-bounds end reports `len`, since an exclusive end never names its index.
/// `start == len` is accepted for an empty range, so `len..` and `len..len` are
/// empty rather than errors.
pub fn resolve_range<R: RangeBounds<usize>>(range: R, len: usize) -> StructureResult<Range<usize>> {
    // A collection cannot hold `usize::MAX + 1` elements, so a saturating bound is
    // out of bounds and caught below.
    let start = match range.start_bound() {
        Bound::Included(&n) => n,
        Bound::Excluded(&n) => n.saturating_add(1),
        Bound::Unbounded => 0,
    };
    // Kept optional so an omitted end is not mistaken for one the caller chose:
    // `len + 1..` is an out-of-bounds start, not a backwards range.
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
