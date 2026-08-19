//! Tests for the CRUD surface on `TableTrait`, run against both tables so they
//! cannot drift: `OrderedTable` shifts cells, `UnorderedTable` reorders a tree.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::ordered_table::OrderedTable;
use bookkeeping_rust::domain::table_column::{TableColumn, Value};
use bookkeeping_rust::domain::table_trait::TableTrait;
use bookkeeping_rust::domain::unordered_table::UnorderedTable;

fn row(age: i32, name: &str) -> Vec<Value> {
    vec![Value::Int(age), Value::Str(name.to_string())]
}

fn indexed_row(i: usize) -> Vec<Value> {
    row(i as i32, &format!("n{i}"))
}

fn ordered(n: usize) -> OrderedTable {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.add_column(TableColumn::<String>::new("Name"));
    for i in 0..n {
        t.append_row(indexed_row(i)).expect("valid row");
    }
    t
}

fn unordered(n: usize) -> UnorderedTable {
    let mut t = UnorderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.add_column(TableColumn::<String>::new("Name"));
    for i in 0..n {
        t.append_row(indexed_row(i)).expect("valid row");
    }
    t
}

fn rows_of<T: TableTrait>(t: &T) -> Vec<Vec<Value>> {
    t.iter_rows()
        .collect::<Result<Vec<_>, _>>()
        .expect("every row reads back")
}

/// Runs `check` against both tables, so a divergence fails rather than hiding.
fn both<F>(n: usize, mut check: F)
where
    F: FnMut(&mut dyn FnMut() -> Box<dyn TableAccess>),
{
    let mut make_ordered: Box<dyn FnMut() -> Box<dyn TableAccess>> =
        Box::new(move || Box::new(ordered(n)));
    check(&mut *make_ordered);
    let mut make_unordered: Box<dyn FnMut() -> Box<dyn TableAccess>> =
        Box::new(move || Box::new(unordered(n)));
    check(&mut *make_unordered);
}

/// Object-safe view of the parts of `TableTrait` these tests exercise, so one
/// test body can drive either table.
trait TableAccess {
    fn nrows(&self) -> usize;
    fn ncols(&self) -> usize;
    fn is_empty(&self) -> bool;
    fn column_names(&self) -> Vec<&str>;
    fn all_rows(&self) -> Vec<Vec<Value>>;
    fn row_at(&self, idx: usize) -> DomainResultRow;
    fn cell_at(&self, row: usize, col: usize) -> Result<Value, DomainError>;
    fn cell_display_at(&self, row: usize, col: usize) -> Result<String, DomainError>;
    fn column_values(&self, col: usize) -> Result<Vec<Value>, DomainError>;
    fn find(&self, needle: i32) -> Result<Option<usize>, DomainError>;
    fn insert_at(&mut self, idx: usize, row: Vec<Value>) -> Result<(), DomainError>;
    fn append_many(&mut self, rows: Vec<Vec<Value>>) -> Result<(), DomainError>;
    fn update_one_cell(&mut self, row: usize, col: usize, val: Value) -> Result<(), DomainError>;
    fn swap(&mut self, first: usize, second: usize) -> Result<(), DomainError>;
    fn move_one(&mut self, from: usize, to: usize) -> Result<(), DomainError>;
    fn move_block(&mut self, from: usize, upto: usize, to: usize) -> Result<(), DomainError>;
    fn remove_at(&mut self, idx: usize) -> DomainResultRow;
    fn remove_range(&mut self, from: usize, to: usize) -> Result<Vec<Vec<Value>>, DomainError>;
    fn remove_tail(&mut self, from: usize) -> Result<Vec<Vec<Value>>, DomainError>;
    fn clear(&mut self);
    fn validate_row(&self, row: &[Value]) -> Result<(), DomainError>;
}

type DomainResultRow = Result<Vec<Value>, DomainError>;

macro_rules! impl_access {
    ($ty:ty) => {
        impl TableAccess for $ty {
            fn nrows(&self) -> usize {
                TableTrait::nrows(self)
            }
            fn ncols(&self) -> usize {
                TableTrait::ncols(self)
            }
            fn is_empty(&self) -> bool {
                TableTrait::is_empty(self)
            }
            fn column_names(&self) -> Vec<&str> {
                TableTrait::column_names(self)
            }
            fn all_rows(&self) -> Vec<Vec<Value>> {
                rows_of(self)
            }
            fn row_at(&self, idx: usize) -> DomainResultRow {
                TableTrait::row(self, idx)
            }
            fn cell_at(&self, row: usize, col: usize) -> Result<Value, DomainError> {
                TableTrait::cell(self, row, col)
            }
            fn cell_display_at(&self, row: usize, col: usize) -> Result<String, DomainError> {
                TableTrait::cell_display(self, row, col)
            }
            fn column_values(&self, col: usize) -> Result<Vec<Value>, DomainError> {
                TableTrait::iter_column(self, col)?.collect()
            }
            fn find(&self, needle: i32) -> Result<Option<usize>, DomainError> {
                TableTrait::find_row(self, |row| row[0] == Value::Int(needle))
            }
            fn insert_at(&mut self, idx: usize, row: Vec<Value>) -> Result<(), DomainError> {
                TableTrait::insert_row_at(self, idx, row)
            }
            fn append_many(&mut self, rows: Vec<Vec<Value>>) -> Result<(), DomainError> {
                TableTrait::append_rows(self, rows)
            }
            fn update_one_cell(
                &mut self,
                row: usize,
                col: usize,
                val: Value,
            ) -> Result<(), DomainError> {
                TableTrait::update_cell(self, row, col, val)
            }
            fn swap(&mut self, first: usize, second: usize) -> Result<(), DomainError> {
                TableTrait::swap_rows_at(self, first, second)
            }
            fn move_one(&mut self, from: usize, to: usize) -> Result<(), DomainError> {
                TableTrait::move_row(self, from, to)
            }
            fn move_block(
                &mut self,
                from: usize,
                upto: usize,
                to: usize,
            ) -> Result<(), DomainError> {
                TableTrait::move_row_range(self, from..upto, to)
            }
            fn remove_at(&mut self, idx: usize) -> DomainResultRow {
                TableTrait::remove_row(self, idx)
            }
            fn remove_range(
                &mut self,
                from: usize,
                to: usize,
            ) -> Result<Vec<Vec<Value>>, DomainError> {
                TableTrait::remove_row_range(self, from..to)
            }
            fn remove_tail(&mut self, from: usize) -> Result<Vec<Vec<Value>>, DomainError> {
                TableTrait::remove_row_range(self, from..)
            }
            fn clear(&mut self) {
                TableTrait::clear_rows(self)
            }
            fn validate_row(&self, row: &[Value]) -> Result<(), DomainError> {
                TableTrait::validate(self, row)
            }
        }
    };
}

impl_access!(OrderedTable);
impl_access!(UnorderedTable);

#[test]
fn shape_is_reported_for_both_tables() {
    both(3, |make| {
        let t = make();
        assert_eq!(t.nrows(), 3);
        assert_eq!(t.ncols(), 2);
        assert!(!t.is_empty());
        assert_eq!(t.column_names(), vec!["Age", "Name"]);
    });
    both(0, |make| {
        let t = make();
        assert!(t.is_empty());
        assert_eq!(t.nrows(), 0);
        assert_eq!(t.ncols(), 2, "columns exist even with no rows");
    });
}

#[test]
fn a_single_row_can_be_read_by_index() {
    both(4, |make| {
        let t = make();
        assert_eq!(t.row_at(0), Ok(indexed_row(0)));
        assert_eq!(t.row_at(3), Ok(indexed_row(3)));
        assert_eq!(
            t.row_at(4),
            Err(DomainError::IndexOutOfBounds { index: 4, len: 4 })
        );
    });
}

#[test]
fn a_single_cell_can_be_read_without_its_row() {
    both(3, |make| {
        let t = make();
        assert_eq!(t.cell_at(1, 0), Ok(Value::Int(1)));
        assert_eq!(t.cell_at(1, 1), Ok(Value::Str("n1".to_string())));
        assert_eq!(t.cell_display_at(2, 0), Ok("2".to_string()));
        // Both axes are bounds-checked.
        assert_eq!(
            t.cell_at(9, 0),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 3 })
        );
        assert_eq!(
            t.cell_at(0, 9),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 2 })
        );
    });
}

#[test]
fn a_column_can_be_read_top_to_bottom() {
    both(4, |make| {
        let t = make();
        assert_eq!(
            t.column_values(0),
            Ok(vec![
                Value::Int(0),
                Value::Int(1),
                Value::Int(2),
                Value::Int(3)
            ])
        );
        assert_eq!(
            t.column_values(1),
            Ok(vec![
                Value::Str("n0".to_string()),
                Value::Str("n1".to_string()),
                Value::Str("n2".to_string()),
                Value::Str("n3".to_string()),
            ])
        );
        assert!(t.column_values(2).is_err());
    });
}

#[test]
fn rows_can_be_found_by_predicate() {
    both(5, |make| {
        let t = make();
        assert_eq!(t.find(3), Ok(Some(3)));
        assert_eq!(t.find(0), Ok(Some(0)));
        assert_eq!(t.find(99), Ok(None));
    });
}

#[test]
fn a_row_can_be_inserted_in_the_middle() {
    both(3, |make| {
        let mut t = make();
        t.insert_at(1, row(99, "inserted")).expect("1 is valid");
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(0),
                row(99, "inserted"),
                indexed_row(1),
                indexed_row(2)
            ]
        );
        assert_eq!(t.nrows(), 4);
    });
}

#[test]
fn inserting_at_the_row_count_appends() {
    both(2, |make| {
        let mut t = make();
        t.insert_at(2, row(7, "last")).expect("nrows appends");
        assert_eq!(t.all_rows().last(), Some(&row(7, "last")));
        assert_eq!(
            t.insert_at(99, row(8, "far")),
            Err(DomainError::IndexOutOfBounds { index: 99, len: 3 })
        );
    });
}

#[test]
fn inserting_at_the_front_shifts_everything_down() {
    both(2, |make| {
        let mut t = make();
        t.insert_at(0, row(42, "first")).expect("0 is valid");
        assert_eq!(
            t.all_rows(),
            vec![row(42, "first"), indexed_row(0), indexed_row(1)]
        );
    });
}

#[test]
fn many_rows_can_be_appended_at_once() {
    both(1, |make| {
        let mut t = make();
        t.append_many(vec![row(5, "five"), row(6, "six")])
            .expect("valid rows");
        assert_eq!(t.nrows(), 3);
        assert_eq!(t.all_rows().last(), Some(&row(6, "six")));
    });
}

#[test]
fn a_batch_append_rejects_all_rows_if_any_is_invalid() {
    both(1, |make| {
        let mut t = make();
        let err = t
            .append_many(vec![row(5, "ok"), vec![Value::Int(6)]])
            .expect_err("the second row is malformed");
        assert_eq!(
            err,
            DomainError::RowLengthMismatch {
                expected: 2,
                actual: 1
            }
        );
        // The valid row was not appended either.
        assert_eq!(t.nrows(), 1, "nothing was written");
    });
}

#[test]
fn one_cell_can_be_updated_without_touching_its_row() {
    both(3, |make| {
        let mut t = make();
        t.update_one_cell(1, 1, Value::Str("changed".to_string()))
            .expect("in bounds");
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(0),
                row(1, "changed"),
                indexed_row(2)
            ]
        );
    });
}

#[test]
fn updating_a_cell_rejects_the_wrong_type_and_bad_indices() {
    both(2, |make| {
        let mut t = make();
        assert_eq!(
            t.update_one_cell(0, 0, Value::Str("nope".to_string())),
            Err(DomainError::ColumnTypeMismatch {
                column: "Age".to_string(),
                expected: "Int",
                actual: "Str",
            })
        );
        assert_eq!(
            t.update_one_cell(9, 0, Value::Int(1)),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 2 })
        );
        assert_eq!(
            t.update_one_cell(0, 9, Value::Int(1)),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 2 })
        );
        // None of the rejections changed anything.
        assert_eq!(t.all_rows(), vec![indexed_row(0), indexed_row(1)]);
    });
}

#[test]
fn rows_can_be_swapped() {
    both(3, |make| {
        let mut t = make();
        t.swap(0, 2).expect("both exist");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(2), indexed_row(1), indexed_row(0)]
        );
        // Swapping a row with itself is a no-op but still bounds-checked.
        t.swap(1, 1).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(2), indexed_row(1), indexed_row(0)]
        );
        assert_eq!(
            t.swap(0, 9),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 3 })
        );
    });
}

#[test]
fn a_row_can_be_removed_and_is_returned() {
    both(4, |make| {
        let mut t = make();
        assert_eq!(t.remove_at(1), Ok(indexed_row(1)));
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(2), indexed_row(3)]
        );
        assert_eq!(t.nrows(), 3);
        assert_eq!(
            t.remove_at(9),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 3 })
        );
    });
}

#[test]
fn removing_the_first_and_last_rows_works() {
    both(3, |make| {
        let mut t = make();
        assert_eq!(t.remove_at(0), Ok(indexed_row(0)));
        assert_eq!(t.remove_at(t.nrows() - 1), Ok(indexed_row(2)));
        assert_eq!(t.all_rows(), vec![indexed_row(1)]);
    });
}

#[test]
fn a_range_of_rows_can_be_removed_in_order() {
    both(6, |make| {
        let mut t = make();
        let removed = t.remove_range(1, 4).expect("in bounds");
        assert_eq!(
            removed,
            vec![indexed_row(1), indexed_row(2), indexed_row(3)],
            "returned in the order they were removed"
        );
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(4), indexed_row(5)]
        );
    });
}

#[test]
fn removing_an_open_ended_range_clears_the_tail() {
    both(4, |make| {
        let mut t = make();
        let removed = t.remove_tail(2).expect("in bounds");
        assert_eq!(removed, vec![indexed_row(2), indexed_row(3)]);
        assert_eq!(t.all_rows(), vec![indexed_row(0), indexed_row(1)]);
    });
}

#[test]
fn removing_an_out_of_bounds_range_is_rejected_before_anything_goes() {
    both(3, |make| {
        let mut t = make();
        assert_eq!(
            t.remove_range(1, 9).err(),
            Some(DomainError::IndexOutOfBounds { index: 3, len: 3 })
        );
        assert_eq!(t.nrows(), 3, "no row was removed");
    });
}

#[test]
fn an_empty_range_removes_nothing() {
    both(3, |make| {
        let mut t = make();
        assert_eq!(t.remove_range(1, 1), Ok(Vec::new()));
        assert_eq!(t.nrows(), 3);
    });
}

#[test]
fn clearing_removes_every_row_but_keeps_the_columns() {
    both(4, |make| {
        let mut t = make();
        t.clear();
        assert!(t.is_empty());
        assert_eq!(t.nrows(), 0);
        assert_eq!(t.ncols(), 2, "columns survive");
        assert_eq!(t.column_names(), vec!["Age", "Name"]);
        assert_eq!(t.all_rows(), Vec::<Vec<Value>>::new());
    });
}

#[test]
fn rows_can_be_appended_again_after_clearing() {
    both(3, |make| {
        let mut t = make();
        t.clear();
        t.insert_at(0, row(1, "fresh")).expect("0 is valid on empty");
        assert_eq!(t.all_rows(), vec![row(1, "fresh")]);
    });
}

#[test]
fn validation_reports_a_bad_row_without_mutating() {
    both(1, |make| {
        let t = make();
        assert!(t.validate_row(&row(1, "fine")).is_ok());
        assert_eq!(
            t.validate_row(&[Value::Int(1)]),
            Err(DomainError::RowLengthMismatch {
                expected: 2,
                actual: 1
            })
        );
        assert_eq!(
            t.validate_row(&[Value::Str("x".to_string()), Value::Str("y".to_string())]),
            Err(DomainError::ColumnTypeMismatch {
                column: "Age".to_string(),
                expected: "Int",
                actual: "Str",
            })
        );
        assert_eq!(t.nrows(), 1);
    });
}

#[test]
fn edits_compose_the_way_an_editor_would_issue_them() {
    both(3, |make| {
        let mut t = make();
        t.insert_at(1, row(10, "ten")).expect("valid");
        t.update_one_cell(0, 1, Value::Str("renamed".to_string()))
            .expect("valid");
        t.swap(0, 3).expect("valid");
        let removed = t.remove_at(1).expect("valid");

        assert_eq!(removed, row(10, "ten"));
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(2), indexed_row(1), row(0, "renamed")]
        );
        assert_eq!(t.nrows(), 3);
    });
}

#[test]
fn clearing_an_unordered_table_frees_its_slots_for_reuse() {
    // `clear_rows` has to reset the allocator, not just empty the columns and the
    // order: otherwise the freed slots are leaked and the columns grow again from
    // where they left off.
    let mut t = unordered(4);
    assert_eq!(t.physical_capacity(), 4);

    t.clear_rows();
    assert_eq!(
        t.physical_capacity(),
        0,
        "the index space is given back, not leaked"
    );

    for i in 0..3 {
        t.append_row(indexed_row(i)).expect("valid row");
    }
    assert_eq!(
        t.physical_capacity(),
        3,
        "refilling reuses the space rather than extending past it"
    );
    assert!(t.free_physical_slots().is_empty());
}

#[test]
fn positional_edits_realign_columns_left_ragged_by_a_padded_update() {
    // `OrderedTable::update_row` pads only the columns it writes, so a write past
    // the end can leave columns of differing lengths. A later insert or removal is
    // positional across all columns, so it has to even them up first or the cells
    // of one row drift apart.
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.add_column(TableColumn::<String>::new("Name"));
    t.append_row(indexed_row(0)).expect("valid row");
    // Writes row 2 and pads row 1, so both columns reach length 3.
    t.update_row(2, row(7, "gap")).expect("padding is allowed");
    assert_eq!(TableTrait::nrows(&t), 3);

    // Insert at the front: every column must shift, keeping rows intact.
    t.insert_row_at(0, row(99, "first")).expect("0 is valid");
    assert_eq!(
        rows_of(&t),
        vec![
            row(99, "first"),
            indexed_row(0),
            row(0, ""),
            row(7, "gap")
        ]
    );

    // And removal from the middle keeps the remaining rows aligned.
    assert_eq!(t.remove_row(2), Ok(row(0, "")));
    assert_eq!(
        rows_of(&t),
        vec![row(99, "first"), indexed_row(0), row(7, "gap")]
    );
}

#[test]
fn positional_edits_realign_columns_left_ragged_by_a_later_add_column() {
    // `add_column` on a populated table leaves the new column shorter than the
    // rest, so a positional insert has to even the columns up first or the cells
    // of a row land at different indices and the row stops reading back.
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.append_row(vec![Value::Int(1)]).expect("valid row");
    t.append_row(vec![Value::Int(2)]).expect("valid row");
    t.add_column(TableColumn::<String>::new("Name"));

    t.insert_row_at(0, row(9, "new")).expect("0 is valid");
    assert_eq!(
        rows_of(&t),
        vec![row(9, "new"), row(1, ""), row(2, "")],
        "every row still reads back after the shift"
    );

    // Removal is positional too, so it has the same requirement.
    assert_eq!(t.remove_row(1), Ok(row(1, "")));
    assert_eq!(rows_of(&t), vec![row(9, "new"), row(2, "")]);
}

#[test]
fn a_row_can_be_removed_from_ragged_columns_without_an_insert_first() {
    // Removal has to even the columns up on its own: reaching a short column at a
    // row index it does not have would otherwise fail outright.
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<i32>::new("Age"));
    t.append_row(vec![Value::Int(1)]).expect("valid row");
    t.append_row(vec![Value::Int(2)]).expect("valid row");
    t.add_column(TableColumn::<String>::new("Name"));

    assert_eq!(t.remove_row(1), Ok(row(2, "")));
    assert_eq!(rows_of(&t), vec![row(1, "")]);
}

#[test]
fn a_row_can_be_moved_down() {
    both(4, |make| {
        let mut t = make();
        t.move_one(0, 2).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(1), indexed_row(2), indexed_row(0), indexed_row(3)],
            "the moved row lands at index 2"
        );
        assert_eq!(t.nrows(), 4, "moving neither adds nor drops rows");
    });
}

#[test]
fn a_row_can_be_moved_up() {
    both(4, |make| {
        let mut t = make();
        t.move_one(3, 1).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(3), indexed_row(1), indexed_row(2)]
        );
    });
}

#[test]
fn the_destination_is_the_index_the_row_ends_up_at() {
    // The same destination gives the same result whichever direction the row
    // travels, which is what makes the argument predictable.
    both(5, |make| {
        let mut t = make();
        t.move_one(0, 3).expect("valid");
        assert_eq!(t.row_at(3), Ok(indexed_row(0)));
    });
    both(5, |make| {
        let mut t = make();
        t.move_one(4, 3).expect("valid");
        assert_eq!(t.row_at(3), Ok(indexed_row(4)));
    });
}

#[test]
fn moving_a_row_to_its_current_position_changes_nothing() {
    both(3, |make| {
        let mut t = make();
        t.move_one(1, 1).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(1), indexed_row(2)]
        );
    });
}

#[test]
fn moving_to_either_end_works() {
    both(4, |make| {
        let mut t = make();
        t.move_one(2, 0).expect("valid");
        assert_eq!(t.row_at(0), Ok(indexed_row(2)));
    });
    both(4, |make| {
        let mut t = make();
        t.move_one(0, 3).expect("the last index is valid");
        assert_eq!(t.row_at(3), Ok(indexed_row(0)));
    });
}

#[test]
fn a_block_of_rows_moves_together_and_keeps_its_order() {
    both(6, |make| {
        let mut t = make();
        t.move_block(0, 2, 3).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(2),
                indexed_row(3),
                indexed_row(4),
                indexed_row(0),
                indexed_row(1),
                indexed_row(5),
            ],
            "rows 0 and 1 sit at 3 and 4, still in order"
        );
    });
}

#[test]
fn a_block_can_move_backwards() {
    both(6, |make| {
        let mut t = make();
        t.move_block(3, 5, 1).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(0),
                indexed_row(3),
                indexed_row(4),
                indexed_row(1),
                indexed_row(2),
                indexed_row(5),
            ]
        );
    });
}

#[test]
fn a_block_destination_is_bounded_by_where_the_block_still_fits() {
    both(5, |make| {
        let mut t = make();
        // A 3-row block in 5 rows fits no further along than index 2.
        t.move_block(0, 3, 2).expect("the block fits at 2");
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(3),
                indexed_row(4),
                indexed_row(0),
                indexed_row(1),
                indexed_row(2),
            ]
        );
    });
    both(5, |make| {
        let mut t = make();
        // One past that would leave the block hanging off the end.
        assert_eq!(
            t.move_block(0, 3, 3),
            Err(DomainError::IndexOutOfBounds { index: 3, len: 3 })
        );
        assert_eq!(t.nrows(), 5, "the rejected move changed nothing");
    });
}

#[test]
fn moving_an_out_of_bounds_row_or_range_is_rejected_before_anything_moves() {
    both(3, |make| {
        let mut t = make();
        assert_eq!(
            t.move_one(9, 0),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 3 })
        );
        assert_eq!(
            t.move_one(0, 9),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 3 })
        );
        assert_eq!(
            t.move_block(1, 9, 0).err(),
            Some(DomainError::IndexOutOfBounds { index: 3, len: 3 })
        );
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(1), indexed_row(2)],
            "no partial move was applied"
        );
    });
}

#[test]
fn moving_an_empty_range_changes_nothing() {
    both(3, |make| {
        let mut t = make();
        t.move_block(1, 1, 0).expect("an empty block is valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(1), indexed_row(2)]
        );
    });
}

#[test]
fn a_full_width_block_can_only_stay_where_it_is() {
    both(3, |make| {
        let mut t = make();
        t.move_block(0, 3, 0).expect("valid");
        assert_eq!(
            t.all_rows(),
            vec![indexed_row(0), indexed_row(1), indexed_row(2)]
        );
        assert!(t.move_block(0, 3, 1).is_err(), "there is nowhere else to go");
    });
}

#[test]
fn repeated_moves_compose_like_dragging_a_row() {
    both(5, |make| {
        let mut t = make();
        for to in 1..5 {
            t.move_one(to - 1, to).expect("valid");
        }
        assert_eq!(t.row_at(4), Ok(indexed_row(0)));
        assert_eq!(
            t.all_rows(),
            vec![
                indexed_row(1),
                indexed_row(2),
                indexed_row(3),
                indexed_row(4),
                indexed_row(0),
            ]
        );
    });
}

#[test]
fn moving_rows_in_an_unordered_table_reuses_slots_rather_than_leaking_them() {
    // Moving is a remove plus an insert, so freed slots have to come back rather
    // than growing the columns on every move.
    let mut t = unordered(4);
    assert_eq!(t.physical_capacity(), 4);

    for _ in 0..10 {
        TableTrait::move_row(&mut t, 0, 3).expect("valid");
    }
    assert_eq!(
        t.physical_capacity(),
        4,
        "ten moves did not extend the index space"
    );
    assert!(t.free_physical_slots().is_empty());
    assert_eq!(TableTrait::nrows(&t), 4);
}
