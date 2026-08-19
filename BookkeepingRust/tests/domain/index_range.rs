//! Tests for `domain::index_range`, which defines the range semantics that every
//! indexed collection in the domain layer shares.
//!
//! The collections are tested separately; these cover the rules themselves, in
//! particular the boundary cases where "empty at the end" has to be accepted and
//! a malformed range has to be told apart from an out-of-bounds one.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::index_range::resolve_range;

#[test]
fn every_range_syntax_resolves_to_the_same_half_open_interval() {
    assert_eq!(resolve_range(2..5, 10), Ok(2..5));
    assert_eq!(resolve_range(2..=4, 10), Ok(2..5));
    assert_eq!(resolve_range(2.., 10), Ok(2..10));
    assert_eq!(resolve_range(..5, 10), Ok(0..5));
    assert_eq!(resolve_range(..=4, 10), Ok(0..5));
    assert_eq!(resolve_range(.., 10), Ok(0..10));
}

#[test]
fn omitted_bounds_are_always_in_bounds() {
    // An omitted bound means "from the beginning" / "to the end", so it cannot be
    // out of bounds even when there is nothing to iterate.
    assert_eq!(resolve_range(.., 0), Ok(0..0));
    assert_eq!(resolve_range(..0, 0), Ok(0..0));
    assert_eq!(resolve_range(0.., 0), Ok(0..0));
}

#[test]
fn the_position_just_past_the_end_is_a_valid_empty_range() {
    // `len` is a valid position, matching how the insert operations treat it, but
    // only for an empty range.
    assert_eq!(resolve_range(10..10, 10), Ok(10..10));
    assert_eq!(resolve_range(10.., 10), Ok(10..10));
    assert_eq!(
        resolve_range(10..11, 10),
        Err(DomainError::IndexOutOfBounds { index: 10, len: 10 })
    );
}

#[test]
fn a_start_past_the_end_reports_the_index_the_caller_named() {
    assert_eq!(
        resolve_range(11..12, 10),
        Err(DomainError::IndexOutOfBounds { index: 11, len: 10 })
    );
    assert_eq!(
        resolve_range(11.., 10),
        Err(DomainError::IndexOutOfBounds { index: 11, len: 10 })
    );
}

#[test]
// `11..` and `11..10` are the pair being contrasted; the latter is backwards on
// purpose, so the lint that normally catches the typo does not apply here.
#[allow(clippy::reversed_empty_ranges)]
fn an_omitted_end_never_makes_a_range_look_backwards() {
    // The end defaults to `len`, so resolving it before the ordering check would
    // turn `11..` on a 10-element collection into a bogus `InvalidRange`. The
    // caller supplied no end, so there is nothing for the start to contradict:
    // this is an out-of-bounds start.
    assert_eq!(
        resolve_range(11.., 10),
        Err(DomainError::IndexOutOfBounds { index: 11, len: 10 })
    );
    assert_eq!(
        resolve_range(usize::MAX.., 10),
        Err(DomainError::IndexOutOfBounds {
            index: usize::MAX,
            len: 10
        })
    );
    // Same collection, same start, but now the end is explicit and does
    // contradict it.
    assert_eq!(
        resolve_range(11..10, 10),
        Err(DomainError::InvalidRange { start: 11, end: 10 })
    );
}

#[test]
fn an_end_past_the_end_reports_len_because_the_end_is_exclusive() {
    // The caller never named index 10 — they asked for everything below it — so
    // echoing their bound back would be misleading. `len` is the first index that
    // does not exist.
    assert_eq!(
        resolve_range(8..13, 10),
        Err(DomainError::IndexOutOfBounds { index: 10, len: 10 })
    );
    // An inclusive end does name its index, and the same rule still applies.
    assert_eq!(
        resolve_range(8..=10, 10),
        Err(DomainError::IndexOutOfBounds { index: 10, len: 10 })
    );
    // The last valid inclusive end is `len - 1`.
    assert_eq!(resolve_range(8..=9, 10), Ok(8..10));
}

#[test]
// These ranges are backwards on purpose: rejecting them is the behaviour under
// test, so the lint that normally catches the typo does not apply here.
#[allow(clippy::reversed_empty_ranges)]
fn a_backwards_range_is_malformed_rather_than_out_of_bounds() {
    // Both bounds are individually in bounds here, so out-of-bounds would be the
    // wrong diagnosis.
    assert_eq!(
        resolve_range(7..3, 10),
        Err(DomainError::InvalidRange { start: 7, end: 3 })
    );
    // Malformed is checked first, so it wins even when the bounds are also out of
    // bounds: it is the more specific description of the mistake.
    assert_eq!(
        resolve_range(99..50, 10),
        Err(DomainError::InvalidRange { start: 99, end: 50 })
    );
    // An inclusive end is normalised before the comparison, so `5..=3` is
    // reported as the resolved `5..4`.
    assert_eq!(
        resolve_range(5..=3, 10),
        Err(DomainError::InvalidRange { start: 5, end: 4 })
    );
}

#[test]
fn an_inclusive_range_of_one_element_is_not_confused_with_an_empty_one() {
    // `n..=n` covers exactly one element; the off-by-one here is easy to get
    // wrong in the `Bound::Included` end normalisation.
    assert_eq!(resolve_range(5..=5, 10), Ok(5..6));
    assert_eq!(resolve_range(0..=0, 1), Ok(0..1));
    // Whereas the exclusive form of the same bounds is empty.
    assert_eq!(resolve_range(5..5, 10), Ok(5..5));
}

#[test]
fn saturating_bounds_are_reported_as_out_of_bounds() {
    // A collection can never hold `usize::MAX + 1` elements, so a bound that
    // saturates during normalisation is out of bounds rather than silently
    // clamped to something valid.
    assert!(resolve_range(..=usize::MAX, 10).is_err());
    assert!(resolve_range(usize::MAX.., 10).is_err());
}
