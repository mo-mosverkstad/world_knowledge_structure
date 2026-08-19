//! Tests for `domain::treearray`. Kept out of the implementation file: these
//! exercise `TreeArray` strictly through its public API.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::treearray::TreeArray;

#[test]
fn out_of_range_access_returns_error() {
    let mut t = TreeArray::<u8>::new();
    t.append(1);

    assert_eq!(
        t.try_get(5),
        Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
    );
    assert_eq!(
        t.set(5, 9),
        Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
    );
    assert_eq!(
        t.delete(5),
        Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
    );
    assert_eq!(
        t.insert(9, 9),
        Err(DomainError::IndexOutOfBounds { index: 9, len: 1 })
    );
    // The rejected operations left the tree untouched.
    assert_eq!(t.in_order(), vec![1]);
}

#[test]
fn empty_tree_operations_do_not_panic() {
    let mut t = TreeArray::<u8>::new();
    assert!(t.is_empty());
    assert_eq!(t.pop(), None);
    assert_eq!(t.get(0), None);
    assert!(t.delete(0).is_err());
    assert!(t.insert(0, 7).is_ok()); // idx == len is a valid append
    assert_eq!(t.in_order(), vec![7]);
}

#[test]
fn insert_delete_keeps_order_and_balance() {
    let mut t = TreeArray::<u16>::new();
    for v in 0..64u16 {
        t.append(v);
    }
    for _ in 0..32 {
        t.delete(0).expect("front element exists");
    }
    assert_eq!(t.len(), 32);
    assert_eq!(t.in_order(), (32..64u16).collect::<Vec<_>>());

    t.insert(0, 999).expect("front is a valid insertion point");
    let len = t.len();
    t.insert(len, 1000).expect("len is a valid insertion point");
    assert_eq!(t.try_get(0), Ok(999));
    assert_eq!(t.try_get(len), Ok(1000));
}

// ----------------------------- Lazy iterator -----------------------------

/// Builds `0, 1, ..., n-1` so that each element's value equals its index, which
/// makes iteration-order assertions readable.
fn indexed_tree(n: u16) -> TreeArray<u16> {
    let mut t = TreeArray::<u16>::new();
    for value in 0..n {
        t.append(value);
    }
    t
}

#[test]
fn iter_visits_every_element_in_index_order() {
    let t = indexed_tree(64);
    let seen: Vec<u16> = t.iter().copied().collect();
    assert_eq!(seen, (0..64u16).collect::<Vec<_>>());
    // The iterator is the source of truth for `in_order`, so they must agree.
    assert_eq!(seen, t.in_order());
    // `iter` is the whole-tree case of `range`, so the two must not drift.
    let full: Vec<u16> = t.range(..).expect("`..` is always valid").copied().collect();
    assert_eq!(full, seen);
}

#[test]
fn iter_on_an_empty_tree_yields_nothing() {
    let t = TreeArray::<u16>::new();
    assert_eq!(t.iter().next(), None);
    assert_eq!(t.iter().count(), 0);
    // An unbounded range on an empty tree is valid, not out of bounds.
    assert_eq!(t.range(..).expect("`..` is always valid").count(), 0);
    assert_eq!(t.range(0..0).expect("empty range at 0").count(), 0);
}

#[test]
fn range_from_seeks_to_the_requested_index() {
    let t = indexed_tree(64);
    // Every start offset must land exactly on that index, including the ends.
    for start in 0..=64usize {
        let seen: Vec<u16> = t
            .range(start..)
            .expect("start is in bounds")
            .copied()
            .collect();
        assert_eq!(seen, (start as u16..64).collect::<Vec<_>>(), "start {start}");
    }
    // Past the end is now an error rather than an empty iterator: an index the
    // caller named has to exist.
    assert_eq!(
        t.range(100..).err(),
        Some(DomainError::IndexOutOfBounds { index: 100, len: 64 })
    );
}

#[test]
fn iteration_agrees_with_repeated_get() {
    // The lazy walk must be observationally identical to the O(m log n) form it
    // replaces, including after the tree has been rebalanced by deletions.
    let mut t = indexed_tree(50);
    for _ in 0..10 {
        t.delete(0).expect("front element exists");
    }
    t.insert(5, 999).expect("index 5 is in bounds");

    let via_get: Vec<u16> = (0..t.len()).map(|i| t.get(i).expect("in bounds")).collect();
    let via_iter: Vec<u16> = t.iter().copied().collect();
    assert_eq!(via_iter, via_get);
}

#[test]
fn range_yields_exactly_the_requested_window() {
    let t = indexed_tree(32);
    let window: Vec<u16> = t
        .range(8..13)
        .expect("8..13 is in bounds")
        .copied()
        .collect();
    assert_eq!(window, vec![8, 9, 10, 11, 12]);

    // An inclusive end covers one more element than the exclusive form.
    let inclusive: Vec<u16> = t
        .range(8..=13)
        .expect("8..=13 is in bounds")
        .copied()
        .collect();
    assert_eq!(inclusive, vec![8, 9, 10, 11, 12, 13]);

    // An open end runs to the last element; an open start begins at 0.
    let head: Vec<u16> = t.range(..4).expect("..4 is in bounds").copied().collect();
    assert_eq!(head, vec![0, 1, 2, 3]);
    let tail: Vec<u16> = t.range(29..).expect("29.. is in bounds").copied().collect();
    assert_eq!(tail, vec![29, 30, 31]);

    // A zero-length range is valid anywhere in bounds, including at the end.
    assert_eq!(t.range(32..32).expect("empty range at end").count(), 0);
    assert_eq!(t.range(0..0).expect("empty range at start").count(), 0);
    // `len..` is the empty range at the end, not an out-of-bounds start.
    assert_eq!(t.range(32..).expect("empty tail at end").count(), 0);
}

#[test]
fn range_validates_bounds_before_yielding_anything() {
    let t = indexed_tree(10);
    // Start beyond the end is rejected, reporting the index the caller named.
    assert_eq!(
        t.range(11..12).err(),
        Some(DomainError::IndexOutOfBounds { index: 11, len: 10 })
    );
    // A start in bounds but a window running past the end is rejected up front,
    // rather than yielding some elements and then failing. The end is exclusive,
    // so the error names `len`, the first index that does not exist.
    assert_eq!(
        t.range(8..13).err(),
        Some(DomainError::IndexOutOfBounds { index: 10, len: 10 })
    );
    // An inclusive end at the last index is in bounds; one past it is not.
    assert!(t.range(8..=9).is_ok());
    assert_eq!(
        t.range(8..=10).err(),
        Some(DomainError::IndexOutOfBounds { index: 10, len: 10 })
    );
}

#[test]
// These ranges are backwards on purpose: rejecting them is the behaviour under
// test, so the lint that normally catches the typo does not apply here.
#[allow(clippy::reversed_empty_ranges)]
fn backwards_ranges_are_rejected_as_malformed() {
    let t = indexed_tree(10);
    // Both bounds are individually in bounds, so this is not an out-of-bounds
    // error: the range itself is not well formed.
    assert_eq!(
        t.range(7..3).err(),
        Some(DomainError::InvalidRange { start: 7, end: 3 })
    );
    // Reported as malformed even when the bounds are also out of bounds, since
    // that is the more specific description of the mistake.
    assert_eq!(
        t.range(99..50).err(),
        Some(DomainError::InvalidRange { start: 99, end: 50 })
    );
    // An inclusive range whose end is below its start is malformed too.
    assert_eq!(
        t.range(5..=3).err(),
        Some(DomainError::InvalidRange { start: 5, end: 4 })
    );
    // `n..=n` is a single element, not an empty or malformed range.
    assert_eq!(
        t.range(5..=5).expect("single element").copied().collect::<Vec<_>>(),
        vec![5]
    );
}

#[test]
fn size_hint_is_exact() {
    let t = indexed_tree(20);
    let mut it = t.range(5..).expect("5.. is in bounds");
    assert_eq!(it.len(), 15);
    assert_eq!(it.size_hint(), (15, Some(15)));

    it.next();
    assert_eq!(it.len(), 14);

    // Draining the iterator brings the reported length to zero.
    let consumed = it.count();
    assert_eq!(consumed, 14);

    let ranged = t.range(2..9).expect("2..9 is in bounds");
    assert_eq!(ranged.len(), 7);
}

#[test]
fn tree_array_can_be_iterated_by_reference() {
    let t = indexed_tree(8);
    // `IntoIterator for &TreeArray` enables `for` loops without calling `iter`.
    let mut sum = 0u32;
    for value in &t {
        sum += *value as u32;
    }
    assert_eq!(sum, (0..8u32).sum::<u32>());
}

#[test]
fn iteration_is_lazy_and_stops_early() {
    // A partial walk must not depend on visiting the whole tree: taking 3 of
    // 1024 elements is the case where O(log n + m) beats a full materialisation.
    let t = indexed_tree(1024);
    let first_three: Vec<u16> = t.iter().copied().take(3).collect();
    assert_eq!(first_three, vec![0, 1, 2]);

    let mut it = t.range(1000..).expect("1000.. is in bounds");
    assert_eq!(it.next(), Some(&1000));
    assert_eq!(it.len(), 23);
}

#[test]
fn full_traversal_visits_each_index_exactly_once() {
    // The amortised O(1) step cost cannot be observed through the public API, so
    // this covers the behaviour that the stack-based walk has to get right: no
    // element is skipped or repeated, and a mid-tree seek reports the correct
    // remaining count without having to touch the prefix.
    let t = indexed_tree(1024);

    assert_eq!(t.iter().count(), 1024);

    let mut expected = 0u16;
    for value in &t {
        assert_eq!(*value, expected);
        expected += 1;
    }
    assert_eq!(expected, 1024);

    let it = t.range(512..).expect("512.. is in bounds");
    assert_eq!(it.len(), 512);
    let tail: Vec<u16> = t
        .range(512..)
        .expect("512.. is in bounds")
        .copied()
        .take(4)
        .collect();
    assert_eq!(tail, vec![512, 513, 514, 515]);
}
