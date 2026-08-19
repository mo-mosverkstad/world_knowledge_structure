use crate::domain::cell_segments::Segments;
use crate::domain::error::DomainResult;
use crate::domain::ordered_table::OrderedTable;
use crate::domain::table_column::TableColumn;
use crate::domain::table_column::Value;
use crate::domain::table_trait::TableTrait;

pub fn cell_segments_demo() -> DomainResult<()> {
    println!(" ------------------------------- Cell Segments Demo ------------------------------- ");

    // A cell is built from at least one segment, and can grow.
    let mut cell = Segments::one("bought milk");
    cell.push("2 litres");
    cell.push("paid cash");
    println!("Segments: {:?}", cell.iter().collect::<Vec<_>>());
    println!("Segment count: {}", cell.len());

    // Segments are addressable and replaceable.
    println!("Segment 1: {}", cell.get(1)?);
    let previous = cell.set(1, "3 litres")?;
    println!("Replaced segment 1 ({previous}) -> {:?}", cell.iter().collect::<Vec<_>>());

    // Inserting at the front displaces the first segment rather than overwriting it.
    cell.insert(0, "groceries")?;
    println!("After insert at 0: {:?}", cell.iter().collect::<Vec<_>>());

    // Removing segment 0 promotes the next one to first.
    let removed = cell.remove(0, "Notes")?;
    println!("Removed segment 0 ({removed}) -> {:?}", cell.iter().collect::<Vec<_>>());

    // Zero segments is refused at construction: a cell always has contents.
    match Segments::new(Vec::new()) {
        Ok(_) => println!("Unexpectedly built a cell with no segments"),
        Err(err) => println!("\nRejected a cell with no segments: {err}"),
    }

    // Shrinking stops at one segment; the last one cannot be removed.
    let mut shrinking = Segments::new(vec!["only".to_string(), "extra".to_string()])?;
    shrinking.remove(1, "Notes")?;
    println!("Shrunk to {} segment(s): {:?}", shrinking.len(), shrinking.iter().collect::<Vec<_>>());
    match shrinking.remove(0, "Notes") {
        Ok(_) => println!("Unexpectedly removed the last segment"),
        Err(err) => println!("Rejected removing the last segment: {err}"),
    }

    // In a table, segmentation is confined to `MultiStr` columns.
    let mut table = OrderedTable::new();
    table.add_column(TableColumn::<String>::new("Item"));
    table.add_column(TableColumn::<Segments>::new("Notes"));
    table.append_row(vec![
        Value::Str("Milk".to_string()),
        Value::MultiStr(cell.clone()),
    ])?;
    table.append_row(vec![
        Value::Str("Bread".to_string()),
        Value::MultiStr(Segments::one("one loaf")),
    ])?;
    println!("\nTable with a segmented column:");
    table.print_table()?;

    // A plain `Str` column cannot hold a segmented cell, so it cannot be segmented.
    match table.append_row(vec![
        Value::MultiStr(Segments::one("segmented")),
        Value::MultiStr(Segments::one("ok")),
    ]) {
        Ok(()) => println!("Unexpectedly segmented a Str column"),
        Err(err) => println!("\nRejected segmenting a Str column: {err}"),
    }
    // Nor can a `MultiStr` column hold an unsegmented value.
    match table.append_row(vec![
        Value::Str("Eggs".to_string()),
        Value::Str("not segmented".to_string()),
    ]) {
        Ok(()) => println!("Unexpectedly accepted a plain value in a MultiStr column"),
        Err(err) => println!("Rejected a plain value in a MultiStr column: {err}"),
    }

    // Rows read back as the segmented values they were written as.
    println!("\nRows via iter_rows():");
    for row in table.iter_rows() {
        println!("  {:?}", row?);
    }

    println!(" ------------------------------------------------------------------------------- \n");
    Ok(())
}
