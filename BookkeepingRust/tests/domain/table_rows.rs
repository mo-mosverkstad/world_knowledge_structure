//! Tests for `domain::table_rows`, the lazy row iteration shared by both tables.
//!
//! The two tables sequence physical indices differently, so each property is
//! checked against both: `OrderedTable` walks a plain range, `UnorderedTable`
//! walks its logical-order `TreeArray` and can have rows whose physical slots
//! are out of order or recycled.

use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::ordered_table::OrderedTable;
use bookkeeping_rust::domain::table_column::{TableColumn, Value};
use bookkeeping_rust::domain::table_trait::TableTrait;
use bookkeeping_rust::domain::unordered_table::UnorderedTable;

fn row(age: i32, name: &str) -> Vec<Value> {
    vec![Value::Int(age), Value::Str(name.to_string())]
}

/// Builds `(0, "n0"), (1, "n1"), ...` so a row's values identify its index.
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

/// Collects a row iterator, failing the test if any row could not be read.
fn collect<T: TableTrait>(rows: T::Rows<'_>) -> Vec<Vec<Value>> {
    rows.collect::<Result<Vec<_>, _>>()
        .expect("every row of a consistent table reads back")
}

#[test]
fn rows_come_back_exactly_as_they_were_fed_in() {
    let expected: Vec<Vec<Value>> = (0..5).map(indexed_row).collect();

    let ord = ordered(5);
    assert_eq!(collect::<OrderedTable>(ord.iter_rows()), expected);

    let unord = unordered(5);
    assert_eq!(collect::<UnorderedTable>(unord.iter_rows()), expected);

    // `iter_rows` is the whole-table case of `row_range(..)`, so they must agree.
    assert_eq!(
        collect::<OrderedTable>(ord.row_range(..).expect("`..` is always valid")),
        expected
    );
    assert_eq!(
        collect::<UnorderedTable>(unord.row_range(..).expect("`..` is always valid")),
        expected
    );
}

#[test]
fn iterating_an_empty_table_yields_nothing() {
    assert_eq!(ordered(0).iter_rows().count(), 0);
    assert_eq!(unordered(0).iter_rows().count(), 0);
    // A table with no columns at all is empty too, not a row of no values.
    assert_eq!(OrderedTable::new().iter_rows().count(), 0);
    assert_eq!(UnorderedTable::new().iter_rows().count(), 0);
    // An unbounded range on an empty table is valid, not out of bounds.
    assert_eq!(
        ordered(0).row_range(..).expect("`..` is always valid").count(),
        0
    );
    assert_eq!(
        unordered(0).row_range(..).expect("`..` is always valid").count(),
        0
    );
}

#[test]
fn an_open_start_seeks_to_the_requested_user_index() {
    let ord = ordered(16);
    let unord = unordered(16);
    for start in 0..=16usize {
        let expected: Vec<Vec<Value>> = (start..16).map(indexed_row).collect();
        assert_eq!(
            collect::<OrderedTable>(ord.row_range(start..).expect("start is in bounds")),
            expected,
            "ordered start {start}"
        );
        assert_eq!(
            collect::<UnorderedTable>(unord.row_range(start..).expect("start is in bounds")),
            expected,
            "unordered start {start}"
        );
    }
    // Past the end is an error rather than an empty iterator: an index the caller
    // named has to exist.
    for err in [ord.row_range(100..).err(), unord.row_range(100..).err()] {
        assert_eq!(err, Some(DomainError::IndexOutOfBounds { index: 100, len: 16 }));
    }
}

#[test]
fn row_range_yields_exactly_the_requested_window() {
    let expected: Vec<Vec<Value>> = (3..7).map(indexed_row).collect();

    let ord = ordered(10);
    let unord = unordered(10);
    assert_eq!(
        collect::<OrderedTable>(ord.row_range(3..7).expect("3..7 is in bounds")),
        expected
    );
    assert_eq!(
        collect::<UnorderedTable>(unord.row_range(3..7).expect("3..7 is in bounds")),
        expected
    );

    // Every range syntax is accepted, with the same bound checks in each case.
    let inclusive: Vec<Vec<Value>> = (3..=7).map(indexed_row).collect();
    assert_eq!(
        collect::<OrderedTable>(ord.row_range(3..=7).expect("3..=7 is in bounds")),
        inclusive
    );
    let head: Vec<Vec<Value>> = (0..3).map(indexed_row).collect();
    assert_eq!(
        collect::<UnorderedTable>(unord.row_range(..3).expect("..3 is in bounds")),
        head
    );

    // A zero-length range is valid anywhere in bounds, including just past the end.
    assert_eq!(ord.row_range(10..10).expect("empty at end").count(), 0);
    assert_eq!(unord.row_range(10..10).expect("empty at end").count(), 0);
    // `nrows..` is the empty range at the end, not an out-of-bounds start.
    assert_eq!(ord.row_range(10..).expect("empty tail at end").count(), 0);
    assert_eq!(unord.row_range(10..).expect("empty tail at end").count(), 0);
}

#[test]
fn row_range_validates_bounds_before_yielding_anything() {
    let ord = ordered(10);
    let unord = unordered(10);

    // Start beyond the end is rejected, reporting the index the caller named.
    for err in [ord.row_range(11..12).err(), unord.row_range(11..12).err()] {
        assert_eq!(err, Some(DomainError::IndexOutOfBounds { index: 11, len: 10 }));
    }
    // A start in bounds whose window runs past the end is rejected up front,
    // rather than yielding some rows and then failing part-way through. The end
    // is exclusive, so the error names `len`, the first row that does not exist.
    for err in [ord.row_range(8..13).err(), unord.row_range(8..13).err()] {
        assert_eq!(err, Some(DomainError::IndexOutOfBounds { index: 10, len: 10 }));
    }
    // An inclusive end at the last row is in bounds; one past it is not.
    assert!(ord.row_range(8..=9).is_ok());
    assert!(unord.row_range(8..=9).is_ok());
    for err in [ord.row_range(8..=10).err(), unord.row_range(8..=10).err()] {
        assert_eq!(err, Some(DomainError::IndexOutOfBounds { index: 10, len: 10 }));
    }
}

#[test]
// These ranges are backwards on purpose: rejecting them is the behaviour under
// test, so the lint that normally catches the typo does not apply here.
#[allow(clippy::reversed_empty_ranges)]
fn backwards_row_ranges_are_rejected_as_malformed() {
    let ord = ordered(10);
    let unord = unordered(10);
    // Both bounds are individually in bounds, so this is not an out-of-bounds
    // error: the range itself is not well formed. Both tables agree.
    for err in [ord.row_range(7..3).err(), unord.row_range(7..3).err()] {
        assert_eq!(err, Some(DomainError::InvalidRange { start: 7, end: 3 }));
    }
    // Malformed takes precedence over out of bounds, as the more specific
    // description of the mistake.
    for err in [ord.row_range(99..50).err(), unord.row_range(99..50).err()] {
        assert_eq!(err, Some(DomainError::InvalidRange { start: 99, end: 50 }));
    }
}

#[test]
fn size_hint_is_exact() {
    let ord = ordered(20);
    let mut it = ord.row_range(5..).expect("5.. is in bounds");
    assert_eq!(it.size_hint(), (15, Some(15)));
    it.next();
    assert_eq!(it.size_hint(), (14, Some(14)));

    let unord = unordered(20);
    let mut it = unord.row_range(5..).expect("5.. is in bounds");
    assert_eq!(it.size_hint(), (15, Some(15)));
    it.next();
    assert_eq!(it.size_hint(), (14, Some(14)));

    assert_eq!(
        ord.row_range(2..9).expect("in bounds").size_hint(),
        (7, Some(7))
    );
    assert_eq!(
        unord.row_range(2..9).expect("in bounds").size_hint(),
        (7, Some(7))
    );
}

#[test]
fn iteration_is_lazy_and_stops_early() {
    // Taking 3 of 512 rows is the case the lazy walk exists for: it must not
    // depend on having visited the whole table.
    let expected: Vec<Vec<Value>> = (0..3).map(indexed_row).collect();

    let ord = ordered(512);
    let first: Vec<Vec<Value>> = ord
        .iter_rows()
        .take(3)
        .map(|r| r.expect("row reads back"))
        .collect();
    assert_eq!(first, expected);

    let unord = unordered(512);
    let first: Vec<Vec<Value>> = unord
        .iter_rows()
        .take(3)
        .map(|r| r.expect("row reads back"))
        .collect();
    assert_eq!(first, expected);
}

#[test]
fn iteration_follows_user_order_not_physical_order() {
    // The point of the unordered table: after inserts, swaps and a recycled
    // slot, physical order no longer matches user order, and iteration must
    // follow the latter.
    let mut t = unordered(3); // rows 0, 1, 2
    t.insert_row(1, row(99, "inserted")).expect("valid row");
    t.delete_row(0).expect("row 0 exists");
    // Reuses the slot freed above, so this row sits early physically but last logically.
    t.append_row(row(77, "recycled")).expect("valid row");
    t.swap_rows(0, 1).expect("both rows exist");

    let rows = collect::<UnorderedTable>(t.iter_rows());
    assert_eq!(
        rows,
        vec![
            indexed_row(1),
            row(99, "inserted"),
            indexed_row(2),
            row(77, "recycled"),
        ]
    );
    // Iteration and nrows agree on how many rows there are.
    assert_eq!(rows.len(), t.nrows());
}

#[test]
fn iteration_agrees_with_the_printed_table() {
    // `print_table` is the other reader of the same data; the two must not drift.
    let mut t = unordered(4);
    t.delete_row(2).expect("row 2 exists");
    t.swap_rows(0, 2).expect("both rows exist");
    assert_eq!(collect::<UnorderedTable>(t.iter_rows()).len(), t.nrows());
    assert!(t.print_table().is_ok());
}

#[test]
fn updates_are_visible_to_later_iteration() {
    let mut ord = ordered(3);
    ord.update_row(1, row(42, "changed")).expect("valid row");
    assert_eq!(
        collect::<OrderedTable>(ord.iter_rows()),
        vec![indexed_row(0), row(42, "changed"), indexed_row(2)]
    );

    let mut unord = unordered(3);
    unord.update_row(1, row(42, "changed")).expect("valid row");
    assert_eq!(
        collect::<UnorderedTable>(unord.iter_rows()),
        vec![indexed_row(0), row(42, "changed"), indexed_row(2)]
    );
}

#[test]
fn padded_ordered_rows_read_back_as_the_column_defaults() {
    // `OrderedTable::update_row` pads the gap with `push_empty`, so those rows
    // exist and must read back as the defaults rather than failing.
    let mut t = ordered(1);
    t.update_row(2, row(7, "gap")).expect("padding is allowed");
    assert_eq!(t.nrows(), 3);
    assert_eq!(
        collect::<OrderedTable>(t.iter_rows()),
        vec![indexed_row(0), row(0, ""), row(7, "gap")]
    );
}
