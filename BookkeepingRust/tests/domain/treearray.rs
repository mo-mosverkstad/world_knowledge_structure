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
