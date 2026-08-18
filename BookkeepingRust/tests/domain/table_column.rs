//! Tests for `domain::table_column`.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::table_column::{Column, TableColumn, Value};

#[test]
fn wrong_variant_is_rejected_on_push_and_update() {
    let mut col = TableColumn::<i32>::new("Age");
    assert!(col.push(Value::Int(5)).is_ok());
    assert_eq!(
        col.push(Value::Str("nope".to_string())),
        Err(DomainError::ColumnTypeMismatch {
            column: "Age".to_string(),
            expected: "Int",
            actual: "Str",
        })
    );
    assert_eq!(
        col.update(0, Value::Float(1.0)),
        Err(DomainError::ColumnTypeMismatch {
            column: "Age".to_string(),
            expected: "Int",
            actual: "Float",
        })
    );
    assert_eq!(col.len(), 1);
    assert_eq!(col.get_value(0), Ok("5".to_string()));
}

#[test]
fn out_of_bounds_access_returns_error() {
    let mut col = TableColumn::<String>::new("Name");
    assert_eq!(
        col.get_value(0),
        Err(DomainError::IndexOutOfBounds { index: 0, len: 0 })
    );
    assert_eq!(
        col.update(0, Value::Str("x".to_string())),
        Err(DomainError::IndexOutOfBounds { index: 0, len: 0 })
    );
}

#[test]
fn accepts_matches_the_stored_variant() {
    let col = TableColumn::<f32>::new("Salary");
    assert!(col.accepts(&Value::Float(1.0)).is_ok());
    assert!(col.accepts(&Value::Double(1.0)).is_err());
}
