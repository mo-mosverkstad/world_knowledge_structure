use crate::domain::error::DomainResult;
use crate::domain::ordered_table::OrderedTable;
use crate::domain::table_column::TableColumn;
use crate::domain::table_column::Value;
use crate::domain::table_trait::TableTrait;
use crate::domain::unordered_table::UnorderedTable;

pub fn table_demo() -> DomainResult<()> {
    println!(" ------------------------------- Table Demo ------------------------------- ");
    // Ordered example
    let mut ord = OrderedTable::new();
    ord.add_column(TableColumn::<i32>::new("Age"));
    ord.add_column(TableColumn::<String>::new("Name"));
    ord.add_column(TableColumn::<f32>::new("Salary"));
    ord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)])?;
    ord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)])?;
    println!("OrderedTable:");
    ord.print_table()?;

    // A malformed row is rejected without corrupting the table.
    match ord.append_row(vec![Value::Int(40), Value::Str("Carol".to_string())]) {
        Ok(()) => println!("Unexpectedly accepted a short row"),
        Err(err) => println!("\nRejected short row: {err}"),
    }
    match ord.append_row(vec![Value::Str("oops".to_string()), Value::Str("Dave".to_string()), Value::Float(1.0)]) {
        Ok(()) => println!("Unexpectedly accepted a mistyped row"),
        Err(err) => println!("Rejected mistyped row: {err}"),
    }
    println!("\nOrderedTable is unchanged after the rejections:");
    ord.print_table()?;

    // Unordered example using TreeArray + recycling
    let mut unord = UnorderedTable::new();
    unord.add_column(TableColumn::<i32>::new("Age"));
    unord.add_column(TableColumn::<String>::new("Name"));
    unord.add_column(TableColumn::<f32>::new("Salary"));

    // append two rows
    unord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)])?;
    unord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)])?;
    println!("\nUnorderedTable after appends:");
    unord.print_table()?;

    // insert at logical index 1
    unord.insert_row(1, vec![Value::Int(22), Value::Str("Elina".to_string()), Value::Float(59929.0)])?;
    println!("\nAfter insert at logical idx 1:");
    unord.print_table()?;

    // delete logical index 0 -> frees a physical slot
    unord.delete_row(0)?;
    println!("\nAfter delete logical idx 0 (frees physical slot):");
    unord.print_table()?;
    println!("Physical capacity: {}", unord.physical_capacity());
    println!("Free physical slots: {:?}", unord.free_physical_slots());

    // insert again (should reuse freed physical index)
    unord.insert_row(1, vec![Value::Int(27), Value::Str("Sam".to_string()), Value::Float(48000.0)])?;
    println!("\nAfter insert at logical idx 0 (should reuse freed physical slot):");
    unord.print_table()?;
    println!("Physical capacity: {}", unord.physical_capacity());
    println!("Free physical slots: {:?}", unord.free_physical_slots());

    // swap rows 0 and 2
    unord.swap_rows(0, 2)?;
    println!("\nAfter swap rows 0 and 2:");
    unord.print_table()?;

    // update row
    unord.update_row(1, vec![Value::Int(99), Value::Str("Updated".to_string()), Value::Float(12345.0)])?;
    println!("\nAfter update logical row 1:");
    unord.print_table()?;

    // Out-of-range row operations are recoverable errors, not panics.
    match unord.delete_row(99) {
        Ok(()) => println!("\nUnexpectedly deleted a nonexistent row"),
        Err(err) => println!("\nRejected delete of row 99: {err}"),
    }

    // show internal mapping & recycling info
    println!("\nInternal logical->physical (in-order): {:?}", unord.get_logical_order().in_order());
    println!("Physical capacity: {}", unord.physical_capacity());
    println!("Free physical slots: {:?}", unord.free_physical_slots());

    // Lazy row fetch: rows come back as the `Vec<Value>` they were fed in as,
    // assembled one at a time rather than materialising the whole table.
    println!("\nOrderedTable rows via iter_rows():");
    for row in ord.iter_rows() {
        println!("  {:?}", row?);
    }

    println!("\nUnorderedTable rows via iter_rows() (user order):");
    for row in unord.iter_rows() {
        println!("  {:?}", row?);
    }

    // A window of rows, validated up front, plus an early-terminating walk.
    println!("\nUnorderedTable row_range(1..3):");
    for row in unord.row_range(1..3)? {
        println!("  {:?}", row?);
    }

    println!("\nFirst row only (the rest is never assembled):");
    if let Some(row) = unord.iter_rows().next() {
        println!("  {:?}", row?);
    }

    // An out-of-range window is reported before any row is produced.
    match unord.row_range(1..99) {
        Ok(_) => println!("\nUnexpectedly accepted an out-of-range row window"),
        Err(err) => println!("\nRejected row_range(1..99): {err}"),
    }

    // A backwards range is a distinct mistake from asking past the end. Built
    // from variables because that is how one actually arises — computed bounds
    // that end up crossed — and a literal `2..1` is rejected at compile time.
    let (from, to) = (2, 1);
    match unord.row_range(from..to) {
        Ok(_) => println!("Unexpectedly accepted a backwards row range"),
        Err(err) => println!("Rejected row_range(2..1): {err}"),
    }

    // ---------------- CRUD utilities ----------------
    println!(" ---------------- CRUD utilities ---------------- ");
    println!("\nShape: {} row(s) x {} column(s), columns {:?}",
        unord.nrows(), unord.ncols(), unord.column_names());

    println!("Row 1: {:?}", unord.row(1)?);
    println!("Cell (1, 1): {:?}", unord.cell(1, 1)?);
    println!("Cell (1, 1) displayed: {}", unord.cell_display(1, 1)?);
    let ages: Vec<Value> = unord.iter_column(0)?.collect::<DomainResult<_>>()?;
    println!("Column 0 top to bottom: {ages:?}");

    let found = unord.find_row(|row| row[0] == Value::Int(22))?;
    println!("Row with Age 22 is at index {found:?}");

    unord.update_cell(0, 1, Value::Str("Renamed".to_string()))?;
    println!("\nAfter update_cell(0, 1):");
    unord.print_table()?;

    unord.insert_row_at(1, vec![Value::Int(31), Value::Str("Inserted".to_string()), Value::Float(31000.0)])?;
    println!("\nAfter insert_row_at(1):");
    unord.print_table()?;

    let removed = unord.remove_row_range(1..3)?;
    println!("\nremove_row_range(1..3) removed {} row(s):", removed.len());
    for row in &removed {
        println!("  {row:?}");
    }
    unord.print_table()?;

    // Batch append is all-or-nothing.
    match unord.append_rows(vec![
        vec![Value::Int(50), Value::Str("Valid".to_string()), Value::Float(1.0)],
        vec![Value::Int(51)],
    ]) {
        Ok(()) => println!("\nUnexpectedly accepted a batch with a bad row"),
        Err(err) => println!("\nRejected the whole batch: {err}"),
    }
    println!("Still {} row(s) after the rejected batch", unord.nrows());

    // Moving relocates rows without changing their contents; `to` is where the
    // block ends up.
    unord.append_rows(vec![
        vec![Value::Int(41), Value::Str("Rowan".to_string()), Value::Float(41000.0)],
        vec![Value::Int(42), Value::Str("Sasha".to_string()), Value::Float(42000.0)],
    ])?;
    println!("\nBefore moving:");
    unord.print_table()?;

    unord.move_row(0, 2)?;
    println!("\nAfter move_row(0, 2):");
    unord.print_table()?;

    unord.move_row_range(0..2, 1)?;
    println!("\nAfter move_row_range(0..2, 1):");
    unord.print_table()?;

    // The furthest a 2-row block fits in 4 rows is index 2, so 3 is refused.
    match unord.move_row_range(0..2, 3) {
        Ok(()) => println!("Unexpectedly moved a block past the end"),
        Err(err) => println!("\nRejected move_row_range(0..2, 3): {err}"),
    }

    unord.clear_rows()?;
    println!("\nAfter clear_rows: {} row(s), {} column(s)", unord.nrows(), unord.ncols());

    println!(" ------------------------------------------------------------------------------- \n");

    Ok(())
}
