use crate::domain::child_link::ChildLink;
use crate::domain::error::DomainResult;
use crate::domain::ordered_table::OrderedTable;
use crate::domain::table_column::TableColumn;
use crate::domain::table_column::Value;
use crate::domain::table_registry::TableRegistry;
use crate::domain::table_trait::TableTrait;

/// A leaf table: items and amounts, no child column.
fn leaf_table() -> OrderedTable {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t.add_column(TableColumn::<f32>::new("Amount"));
    t
}

/// A non-leaf table, whose third column is reserved for child links.
fn parent_table() -> DomainResult<OrderedTable> {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t.add_column(TableColumn::<f32>::new("Amount"));
    t.add_column(TableColumn::<ChildLink>::new("Child"));
    t.set_child_column(2)?;
    Ok(t)
}

pub fn table_registry_demo() -> DomainResult<()> {
    println!(" ------------------------------- Table Registry Demo ------------------------------- ");

    let mut registry = TableRegistry::new();
    let root = registry.register("Root", parent_table()?)?;
    let expenses = registry.register("Expenses", leaf_table())?;
    let income = registry.register("Income", leaf_table())?;

    println!("Registered {} table(s):", registry.len());
    for id in registry.ids() {
        println!("  id {} -> {}", id.index(), registry.name(id)?);
    }

    // Rows are appended normally; the child column defaults to empty.
    registry.get_mut(root)?.append_rows(vec![
        vec![
            Value::Str("Spending".to_string()),
            Value::Float(1500.0),
            Value::Child(ChildLink::EMPTY),
        ],
        vec![
            Value::Str("Earning".to_string()),
            Value::Float(3000.0),
            Value::Child(ChildLink::EMPTY),
        ],
        vec![
            Value::Str("Also spending".to_string()),
            Value::Float(200.0),
            Value::Child(ChildLink::EMPTY),
        ],
    ])?;

    // Links are created only through the registry, which counts them.
    registry.set_child(root, 0, expenses)?;
    registry.set_child(root, 1, income)?;
    registry.set_child(root, 2, expenses)?;
    println!("\nRoot with child links:");
    registry.get(root)?.print_table()?;
    println!(
        "References: Expenses {}, Income {}",
        registry.references(expenses)?,
        registry.references(income)?
    );
    println!(
        "Row 0 points at {:?}",
        registry.child_of(root, 0)?.map(|id| id.index())
    );

    // The child column cannot be written through the ordinary cell API.
    match registry
        .get_mut(root)?
        .update_cell(0, 2, Value::Child(ChildLink::EMPTY))
    {
        Ok(()) => println!("\nUnexpectedly wrote the child column directly"),
        Err(err) => println!("\nRejected a direct child-column write: {err}"),
    }

    // Nor can a whole-row write clobber a live link.
    match registry.get_mut(root)?.update_row(
        0,
        vec![
            Value::Str("Hijack".to_string()),
            Value::Float(0.0),
            Value::Child(ChildLink::EMPTY),
        ],
    ) {
        Ok(()) => println!("Unexpectedly overwrote a row holding a link"),
        Err(err) => println!("Rejected overwriting a linked row: {err}"),
    }

    // Nor can such a row be removed while the link stands.
    match registry.get_mut(root)?.remove_row(0) {
        Ok(_) => println!("Unexpectedly removed a row holding a link"),
        Err(err) => println!("Rejected removing a linked row: {err}"),
    }

    // A referenced table cannot be deleted.
    match registry.remove(expenses) {
        Ok(_) => println!("Unexpectedly deleted a referenced table"),
        Err(err) => println!("\nRejected deleting Expenses: {err}"),
    }

    // Clearing one of the two links is not enough.
    registry.clear_child(root, 2)?;
    println!(
        "After clearing one link, Expenses has {} reference(s)",
        registry.references(expenses)?
    );
    match registry.remove(expenses) {
        Ok(_) => println!("Unexpectedly deleted a still-referenced table"),
        Err(err) => println!("Still rejected: {err}"),
    }

    // Repointing a link releases the old target and counts the new one.
    registry.set_child(root, 0, income)?;
    println!(
        "\nAfter repointing row 0 to Income: Expenses {}, Income {}",
        registry.references(expenses)?,
        registry.references(income)?
    );

    // Now unreferenced, Expenses can go, and its id is freed for reuse.
    let removed = registry.remove(expenses)?;
    println!("Deleted Expenses (held {} row(s))", removed.nrows());
    let assets = registry.register("Assets", leaf_table())?;
    println!(
        "'Assets' reused id {} with {} reference(s)",
        assets.index(),
        registry.references(assets)?
    );

    // Clearing a table is refused while any of its rows still link out.
    match registry.get_mut(root)?.clear_rows() {
        Ok(()) => println!("\nUnexpectedly cleared a table holding links"),
        Err(err) => println!("\nRejected clearing a table with links: {err}"),
    }

    // Once every link is cleared, the table clears and the children are released.
    for row in 0..registry.get(root)?.nrows() {
        registry.clear_child(root, row)?;
    }
    registry.get_mut(root)?.clear_rows()?;
    println!(
        "After clearing every link: Root has {} row(s), Income {} reference(s)",
        registry.get(root)?.nrows(),
        registry.references(income)?
    );

    println!(" ------------------------------------------------------------------------------- \n");
    Ok(())
}
