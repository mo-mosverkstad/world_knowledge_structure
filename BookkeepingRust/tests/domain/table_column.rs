//! Tests for `domain::table_column`.
//!
//! `Column` is implemented once generically over [`CellType`], so the per-type
//! behaviour that used to live in three separate impls is now declared in one
//! macro invocation. These tests cover each of those declared members against
//! every supported type, since a wrong entry in the macro would otherwise
//! compile silently.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::table_column::{CellType, Column, TableColumn, Value};

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

#[test]
fn the_reported_type_name_is_the_variant_it_names() {
    // `CellType::TYPE_NAME` is the "expected" side of a mismatch and
    // `Value::type_name` the "actual" side. They are declared in different places
    // — the macro derives the former from the variant, the latter is a hand-written
    // match — so a mismatch error could name the same type two different ways.
    fn assert_agrees<T: CellType>(sample: Value) {
        assert_eq!(T::TYPE_NAME, sample.type_name());
    }
    assert_agrees::<i32>(Value::Int(0));
    assert_agrees::<String>(Value::Str(String::new()));
    assert_agrees::<f32>(Value::Float(0.0));
}

#[test]
fn cells_read_back_as_the_variant_they_were_written_as() {
    // The round trip through `push`/`get` is what lets a table hand a row back in
    // the shape it was supplied in, so each type has to rewrap into its own
    // variant rather than a merely compatible one.
    let mut ints = TableColumn::<i32>::new("Age");
    ints.push(Value::Int(-5)).expect("matching variant");
    assert_eq!(ints.get(0), Ok(Value::Int(-5)));

    let mut strings = TableColumn::<String>::new("Name");
    strings
        .push(Value::Str("Alice".to_string()))
        .expect("matching variant");
    assert_eq!(strings.get(0), Ok(Value::Str("Alice".to_string())));

    let mut floats = TableColumn::<f32>::new("Salary");
    floats.push(Value::Float(1.5)).expect("matching variant");
    assert_eq!(floats.get(0), Ok(Value::Float(1.5)));
}

#[test]
fn padded_slots_hold_the_per_type_default() {
    // `push_empty` fills the gap left by a write past the end, so the padding has
    // to be a real value of the stored type, not a placeholder shared across types.
    let mut ints = TableColumn::<i32>::new("Age");
    ints.push_empty();
    assert_eq!(ints.get(0), Ok(Value::Int(0)));
    assert_eq!(ints.get_value(0), Ok("0".to_string()));

    let mut strings = TableColumn::<String>::new("Name");
    strings.push_empty();
    assert_eq!(strings.get(0), Ok(Value::Str(String::new())));

    let mut floats = TableColumn::<f32>::new("Salary");
    floats.push_empty();
    assert_eq!(floats.get(0), Ok(Value::Float(0.0)));
}

#[test]
fn the_display_form_is_per_type_and_distinct_from_debug() {
    // `get_value` is what `print_table` shows, so strings appear unquoted and
    // floats are fixed to two decimals to keep a money column aligned.
    let mut floats = TableColumn::<f32>::new("Salary");
    floats.push(Value::Float(1.5)).expect("matching variant");
    floats.push(Value::Float(60000.0)).expect("matching variant");
    assert_eq!(floats.get_value(0), Ok("1.50".to_string()));
    assert_eq!(floats.get_value(1), Ok("60000.00".to_string()));

    let mut strings = TableColumn::<String>::new("Name");
    strings
        .push(Value::Str("Alice".to_string()))
        .expect("matching variant");
    assert_eq!(strings.get_value(0), Ok("Alice".to_string()));
}

#[test]
fn a_wrong_variant_is_reported_even_when_the_index_is_also_invalid() {
    // The type check runs before the bounds check, so the more specific mistake
    // is the one reported. Worth pinning: the two checks are separate statements
    // in the generic `update`, so their order is easy to swap by accident.
    let mut col = TableColumn::<i32>::new("Age");
    assert_eq!(
        col.update(99, Value::Str("nope".to_string())),
        Err(DomainError::ColumnTypeMismatch {
            column: "Age".to_string(),
            expected: "Int",
            actual: "Str",
        })
    );
    // The right variant at a bad index is still out of bounds.
    assert_eq!(
        col.update(99, Value::Int(1)),
        Err(DomainError::IndexOutOfBounds { index: 99, len: 0 })
    );
}

#[test]
fn a_rejected_value_leaves_the_column_untouched() {
    let mut col = TableColumn::<i32>::new("Age");
    col.push(Value::Int(1)).expect("matching variant");
    assert!(col.push(Value::Float(2.0)).is_err());
    // The rejected push neither grew the column nor disturbed the existing cell.
    assert_eq!(col.len(), 1);
    assert_eq!(col.get(0), Ok(Value::Int(1)));
}
