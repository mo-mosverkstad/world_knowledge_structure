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
    assert_eq!(t.get_next_physical_index(), 0);
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
    assert_eq!(t.get_next_physical_index(), 0);
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
    assert_eq!(t.get_next_physical_index(), 2);

    t.delete_row(0).expect("row 0 exists");
    assert_eq!(t.get_free_physical().len(), 1);

    t.append_row(row(27, "Sam")).expect("valid row");
    // The freed slot was reused rather than growing the columns.
    assert_eq!(t.get_next_physical_index(), 2);
    assert!(t.get_free_physical().is_empty());
    assert_eq!(t.nrows(), 2);
}

#[test]
fn printing_an_empty_table_succeeds() {
    let t = UnorderedTable::new();
    assert!(t.print_table().is_ok());
    assert!(table().print_table().is_ok());
}
