//! Tests for `domain::unordered_table`.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::table_column::{TableColumn, Value};
use bookkeeping_rust::domain::table_trait::TableTrait;
use bookkeeping_rust::domain::unordered_table::UnorderedTable;

fn table() -> UnorderedTable {
    let mut t = UnorderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.add_column(TableColumn::<String>::new("Name"));
    t
}

fn row(age: i32, name: &str) -> Vec<Value> {
    vec![Value::Int(age), Value::Str(name.to_string())]
}

#[test]
fn row_length_mismatch_is_reported() {
    let mut t = table();
    assert_eq!(
        t.append_row(vec![Value::Int(1)]),
        Err(DomainError::RowLengthMismatch { expected: 2, actual: 1 })
    );
    // Nothing was allocated for the rejected row.
    assert_eq!(t.nrows(), 0);
    assert_eq!(t.physical_capacity(), 0);
}

#[test]
fn type_mismatch_is_reported_before_mutating() {
    let mut t = table();
    assert_eq!(
        t.append_row(vec![Value::Str("x".to_string()), Value::Str("y".to_string())]),
        Err(DomainError::ColumnTypeMismatch {
            column: "Age".to_string(),
            expected: "Int",
            actual: "Str",
        })
    );
    assert_eq!(t.nrows(), 0);
    assert_eq!(t.physical_capacity(), 0);
}

#[test]
fn missing_rows_are_reported() {
    let mut t = table();
    t.append_row(row(30, "Bob")).expect("valid row");

    assert!(matches!(
        t.delete_row(7),
        Err(DomainError::IndexOutOfBounds { index: 7, len: 1 })
    ));
    assert!(matches!(
        t.update_row(7, row(1, "a")),
        Err(DomainError::IndexOutOfBounds { index: 7, len: 1 })
    ));
    assert!(matches!(
        t.swap_rows(0, 7),
        Err(DomainError::IndexOutOfBounds { index: 7, len: 1 })
    ));
    assert!(matches!(
        t.insert_row(7, row(1, "a")),
        Err(DomainError::IndexOutOfBounds { index: 7, len: 1 })
    ));
    assert_eq!(t.nrows(), 1);
}

#[test]
fn deleted_physical_slots_are_recycled() {
    let mut t = table();
    t.append_row(row(25, "Alice")).expect("valid row");
    t.append_row(row(30, "Bob")).expect("valid row");
    assert_eq!(t.physical_capacity(), 2);

    t.delete_row(0).expect("row 0 exists");
    assert_eq!(t.free_physical_slots().len(), 1);

    t.append_row(row(27, "Sam")).expect("valid row");
    // The freed slot was reused rather than growing the columns.
    assert_eq!(t.physical_capacity(), 2);
    assert!(t.free_physical_slots().is_empty());
    assert_eq!(t.nrows(), 2);
}

#[test]
fn printing_an_empty_table_succeeds() {
    let t = UnorderedTable::new();
    assert!(t.print_table().is_ok());
    assert!(table().print_table().is_ok());
}

#[test]
fn a_reused_slot_is_not_freed_twice_by_deleting_the_row_that_reused_it() {
    // Deleting, reusing the slot, then deleting again must free it once per
    // occupant rather than double-freeing.
    let mut t = table();
    t.append_row(row(25, "Alice")).expect("valid row");
    t.append_row(row(30, "Bob")).expect("valid row");

    t.delete_row(0).expect("row 0 exists");
    assert_eq!(t.free_physical_slots().len(), 1);

    t.append_row(row(27, "Sam")).expect("valid row");
    assert!(t.free_physical_slots().is_empty(), "the slot was reused");

    // Sam is now at user index 1; deleting frees the reused slot exactly once.
    t.delete_row(1).expect("row 1 exists");
    assert_eq!(t.free_physical_slots().len(), 1);
    assert_eq!(t.physical_capacity(), 2, "no slot was leaked or duplicated");
    assert_eq!(t.nrows(), 1);
}

#[test]
fn deleting_every_row_frees_each_slot_once() {
    let mut t = table();
    for i in 0..4 {
        t.append_row(row(i, "x")).expect("valid row");
    }
    // Always deleting at 0 walks a shifting user index over distinct slots.
    for _ in 0..4 {
        t.delete_row(0).expect("not empty");
    }
    assert_eq!(t.nrows(), 0);
    assert_eq!(t.physical_capacity(), 4);
    assert_eq!(t.free_physical_slots(), vec![0, 1, 2, 3]);

    // Every slot is reusable, so refilling does not extend the columns.
    for i in 0..4 {
        t.append_row(row(i, "y")).expect("valid row");
    }
    assert_eq!(t.physical_capacity(), 4);
    assert!(t.free_physical_slots().is_empty());
}

#[test]
fn a_rejected_row_consumes_no_slot() {
    let mut t = table();
    t.append_row(row(1, "a")).expect("valid row");
    assert!(t.append_row(vec![Value::Int(2)]).is_err());
    assert!(t.insert_row(99, row(3, "c")).is_err());
    assert_eq!(t.physical_capacity(), 1, "no slot was handed out");

    t.append_row(row(4, "d")).expect("valid row");
    assert_eq!(t.physical_capacity(), 2);
}
