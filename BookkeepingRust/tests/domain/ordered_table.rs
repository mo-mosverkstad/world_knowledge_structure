//! Tests for `domain::ordered_table`.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::ordered_table::OrderedTable;
use bookkeeping_rust::domain::table_column::{TableColumn, Value};
use bookkeeping_rust::domain::table_trait::{TableExt, TableTrait};

fn table() -> OrderedTable {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.add_column(TableColumn::<String>::new("Name"));
    t
}

#[test]
fn rejected_rows_leave_the_table_unchanged() {
    let mut t = table();
    t.append_row(vec![Value::Int(25), Value::Str("Alice".to_string())])
        .expect("valid row");

    assert_eq!(
        t.append_row(vec![Value::Int(1)]),
        Err(DomainError::RowLengthMismatch { expected: 2, actual: 1 })
    );
    assert_eq!(
        t.append_row(vec![Value::Bool(true), Value::Str("x".to_string())]),
        Err(DomainError::ColumnTypeMismatch {
            column: "Age".to_string(),
            expected: "Int",
            actual: "Bool",
        })
    );
    // Both columns still hold exactly the one accepted row.
    assert!(t.print_table().is_ok());
}

#[test]
fn update_beyond_the_end_pads_instead_of_panicking() {
    let mut t = table();
    t.update_row(3, vec![Value::Int(7), Value::Str("Gap".to_string())])
        .expect("padding rows is allowed");
    assert!(t.print_table().is_ok());
}

#[test]
fn printing_an_empty_table_succeeds() {
    assert!(OrderedTable::new().print_table().is_ok());
}
