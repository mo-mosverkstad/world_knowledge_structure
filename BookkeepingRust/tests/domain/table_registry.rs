//! Tests for `domain::table_registry`.
//!
//! Reference counts are only reachable through the link API, so these drive them
//! the way a caller must: by setting and clearing child links.

use bookkeeping_rust::domain::child_link::ChildLink;
use bookkeeping_rust::domain::error::DomainError;
use bookkeeping_rust::domain::ordered_table::OrderedTable;
use bookkeeping_rust::domain::table_column::{TableColumn, Value};
use bookkeeping_rust::domain::table_registry::{TableId, TableRegistry};
use bookkeeping_rust::domain::table_trait::{TableExt, TableTrait};
use bookkeeping_rust::domain::unordered_table::UnorderedTable;

fn leaf() -> OrderedTable {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t
}

/// A table whose column 1 is reserved for child links.
fn parent() -> OrderedTable {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t.add_column(TableColumn::<ChildLink>::new("Child"));
    t.set_child_column(1).expect("column 1 holds child links");
    t
}

fn row(item: &str) -> Vec<Value> {
    vec![
        Value::Str(item.to_string()),
        Value::Child(ChildLink::EMPTY),
    ]
}

/// A registry holding one parent with `rows` empty rows, plus two leaf children.
fn hierarchy(rows: usize) -> (TableRegistry, TableId, TableId, TableId) {
    let mut reg = TableRegistry::new();
    let root = reg.register("Root", parent()).expect("space available");
    let a = reg.register("A", leaf()).expect("space available");
    let b = reg.register("B", leaf()).expect("space available");
    for i in 0..rows {
        reg.get_mut(root)
            .expect("registered")
            .append_row(row(&format!("r{i}")))
            .expect("valid row");
    }
    (reg, root, a, b)
}

#[test]
fn a_new_registry_is_empty() {
    let reg = TableRegistry::new();
    assert!(reg.is_empty());
    assert_eq!(reg.len(), 0);
    assert_eq!(reg.ids().count(), 0);
}

#[test]
fn registered_tables_are_reachable_by_id() {
    let (reg, root, a, _) = hierarchy(0);
    assert_eq!(reg.len(), 3);
    assert_eq!(reg.name(root), Ok("Root"));
    assert_eq!(reg.name(a), Ok("A"));
    assert!(reg.contains(a));
}

#[test]
fn tables_can_be_found_and_renamed() {
    let (mut reg, _, a, _) = hierarchy(0);
    assert_eq!(reg.find_by_name("A"), Some(a));
    assert_eq!(reg.find_by_name("Missing"), None);
    assert_eq!(reg.rename(a, "Renamed"), Ok("A".to_string()));
    assert_eq!(reg.find_by_name("A"), None);
    assert_eq!(reg.find_by_name("Renamed"), Some(a));
}

#[test]
fn an_unknown_id_is_reported_rather_than_resolving() {
    let (mut reg, _, a, _) = hierarchy(0);
    reg.remove(a).expect("unreferenced");
    assert!(!reg.contains(a));
    assert_eq!(
        reg.get(a).err(),
        Some(DomainError::TableNotFound { table: 1 })
    );
    assert_eq!(
        reg.references(a).err(),
        Some(DomainError::TableNotFound { table: 1 })
    );
}

#[test]
fn a_link_can_only_be_created_through_the_registry() {
    let (mut reg, root, a, _) = hierarchy(1);
    // The ordinary cell API refuses the child column outright.
    assert_eq!(
        reg.get_mut(root)
            .expect("registered")
            .update_cell(0, 1, Value::Child(ChildLink::EMPTY)),
        Err(DomainError::ChildColumnProtected { column: 1 })
    );
    // The registry is the way in, and it counts the link.
    reg.set_child(root, 0, a).expect("valid");
    assert_eq!(reg.references(a), Ok(1));
    assert_eq!(reg.child_of(root, 0), Ok(Some(a)));
}

#[test]
fn a_row_cannot_smuggle_in_a_populated_link() {
    // `ChildLink::to` is crate-internal, so a caller cannot build a populated link
    // to append; an empty one is fine and is what padding produces.
    let (mut reg, root, _, _) = hierarchy(0);
    reg.get_mut(root)
        .expect("registered")
        .append_row(row("ok"))
        .expect("an empty link is allowed");
    assert_eq!(reg.child_of(root, 0), Ok(None));
}

#[test]
fn each_linking_row_counts_separately() {
    let (mut reg, root, a, _) = hierarchy(2);
    reg.set_child(root, 0, a).expect("valid");
    reg.set_child(root, 1, a).expect("valid");
    assert_eq!(reg.references(a), Ok(2), "one per linking row");

    reg.clear_child(root, 0).expect("valid");
    assert_eq!(reg.references(a), Ok(1));
    assert_eq!(
        reg.remove(a).err(),
        Some(DomainError::TableStillReferenced {
            table: 1,
            references: 1
        })
    );

    reg.clear_child(root, 1).expect("valid");
    assert_eq!(reg.references(a), Ok(0));
    assert!(reg.remove(a).is_ok());
}

#[test]
fn repointing_a_link_releases_the_old_target() {
    let (mut reg, root, a, b) = hierarchy(1);
    reg.set_child(root, 0, a).expect("valid");
    assert_eq!((reg.references(a), reg.references(b)), (Ok(1), Ok(0)));

    reg.set_child(root, 0, b).expect("valid");
    assert_eq!(
        (reg.references(a), reg.references(b)),
        (Ok(0), Ok(1)),
        "the count moved with the link"
    );
    assert_eq!(reg.child_of(root, 0), Ok(Some(b)));
    // The released table is deletable again.
    assert!(reg.remove(a).is_ok());
}

#[test]
fn setting_the_same_link_twice_counts_once() {
    let (mut reg, root, a, _) = hierarchy(1);
    reg.set_child(root, 0, a).expect("valid");
    reg.set_child(root, 0, a).expect("valid");
    assert_eq!(reg.references(a), Ok(1), "idempotent, not double-counted");
}

#[test]
fn clearing_an_empty_link_is_a_no_op() {
    let (mut reg, root, a, _) = hierarchy(1);
    // No link yet, so nothing to release and no corruption reported.
    assert!(reg.clear_child(root, 0).is_ok());
    assert_eq!(reg.references(a), Ok(0));
}

#[test]
fn a_referenced_table_cannot_be_deleted() {
    let (mut reg, root, a, _) = hierarchy(1);
    reg.set_child(root, 0, a).expect("valid");
    assert_eq!(reg.is_deletable(a), Ok(false));
    assert_eq!(
        reg.remove(a).err(),
        Some(DomainError::TableStillReferenced {
            table: 1,
            references: 1
        })
    );
    assert!(reg.contains(a), "the refusal left it in place");
}

#[test]
fn a_linked_row_cannot_be_overwritten_or_removed() {
    // Either would drop the link without the registry noticing.
    let (mut reg, root, a, _) = hierarchy(2);
    reg.set_child(root, 0, a).expect("valid");

    let table = reg.get_mut(root).expect("registered");
    assert_eq!(
        table.update_row(0, row("hijack")),
        Err(DomainError::ChildLinkPresent { row: 0 })
    );
    assert_eq!(
        table.remove_row(0).err(),
        Some(DomainError::ChildLinkPresent { row: 0 })
    );
    // A row without a link is unaffected.
    assert!(table.remove_row(1).is_ok());
    assert_eq!(reg.references(a), Ok(1), "the link survived");
}

#[test]
fn a_table_cannot_be_cleared_while_a_row_still_links_out() {
    let (mut reg, root, a, _) = hierarchy(2);
    reg.set_child(root, 1, a).expect("valid");
    assert_eq!(
        reg.get_mut(root).expect("registered").clear_rows(),
        Err(DomainError::ChildLinkPresent { row: 1 })
    );

    reg.clear_child(root, 1).expect("valid");
    assert!(reg.get_mut(root).expect("registered").clear_rows().is_ok());
    assert_eq!(reg.references(a), Ok(0));
}

#[test]
fn linking_to_an_unregistered_table_is_rejected() {
    let (mut reg, root, a, _) = hierarchy(1);
    reg.remove(a).expect("unreferenced");
    assert_eq!(
        reg.set_child(root, 0, a),
        Err(DomainError::TableNotFound { table: 1 })
    );
    assert_eq!(reg.child_of(root, 0), Ok(None), "nothing was written");
}

#[test]
fn a_leaf_table_has_no_child_column() {
    let (reg, _, a, _) = hierarchy(0);
    assert_eq!(reg.get(a).map(|t| t.child_column()), Ok(None));
    // Asking for its child reports nothing rather than failing.
    assert_eq!(reg.child_of(a, 0), Ok(None));
}

#[test]
fn a_column_that_does_not_hold_links_cannot_be_reserved() {
    let mut t = OrderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    assert_eq!(
        t.set_child_column(0),
        Err(DomainError::NotAChildColumn { column: 0 })
    );
    assert_eq!(t.child_column(), None);
}

#[test]
fn a_deleted_id_is_reused_with_a_fresh_count() {
    // Reuse is safe because a referenced table cannot be deleted, so no live link
    // can be reattached to whatever takes the id next.
    let (mut reg, root, a, _) = hierarchy(1);
    reg.set_child(root, 0, a).expect("valid");
    assert!(reg.remove(a).is_err(), "protected while linked");

    reg.clear_child(root, 0).expect("valid");
    reg.remove(a).expect("now unreferenced");

    let reused = reg.register("C", leaf()).expect("space available");
    assert_eq!(reused.index(), a.index());
    assert_eq!(reg.references(reused), Ok(0), "counts do not carry over");
}

/// An unordered leaf, to pair with the ordered ones the other tests build.
fn unordered_leaf() -> UnorderedTable {
    let mut t = UnorderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t
}

/// A parent whose column 1 is reserved for child links, stored unordered.
fn unordered_parent() -> UnorderedTable {
    let mut t = UnorderedTable::new();
    t.add_column(TableColumn::<String>::new("Item"));
    t.add_column(TableColumn::<ChildLink>::new("Child"));
    t.set_child_column(1).expect("column 1 holds child links");
    t
}

#[test]
fn one_registry_holds_both_table_types_at_once() {
    // The point of storing `Box<dyn TableTrait>`: the registry is not fixed to a
    // single table type, so a hierarchy can mix them.
    let mut reg = TableRegistry::new();
    let ord_root = reg.register("OrderedRoot", parent()).expect("space available");
    let unord_root = reg
        .register("UnorderedRoot", unordered_parent())
        .expect("space available");
    let ord_leaf = reg.register("OrderedLeaf", leaf()).expect("space available");
    let unord_leaf = reg
        .register("UnorderedLeaf", unordered_leaf())
        .expect("space available");
    assert_eq!(reg.len(), 4);

    for root in [ord_root, unord_root] {
        reg.get_mut(root)
            .expect("registered")
            .append_row(row("r0"))
            .expect("valid row");
    }

    // Links cross the type boundary in both directions.
    reg.set_child(ord_root, 0, unord_leaf).expect("valid");
    reg.set_child(unord_root, 0, ord_leaf).expect("valid");
    assert_eq!(reg.child_of(ord_root, 0), Ok(Some(unord_leaf)));
    assert_eq!(reg.child_of(unord_root, 0), Ok(Some(ord_leaf)));
    assert_eq!(reg.references(unord_leaf), Ok(1));
    assert_eq!(reg.references(ord_leaf), Ok(1));

    // Protection applies to whichever type holds the link.
    assert_eq!(
        reg.remove(ord_leaf).err(),
        Some(DomainError::TableStillReferenced {
            table: ord_leaf.index(),
            references: 1
        })
    );

    // Iteration yields both as `&dyn TableTrait`, so one loop reads every table.
    let names: Vec<&str> = reg
        .iter()
        .map(|(id, _)| reg.name(id).expect("registered"))
        .collect();
    assert_eq!(
        names,
        vec!["OrderedRoot", "UnorderedRoot", "OrderedLeaf", "UnorderedLeaf"]
    );
    for (_, table) in reg.iter() {
        assert_eq!(table.ncols(), if table.child_column().is_some() { 2 } else { 1 });
    }

    reg.clear_child(ord_root, 0).expect("valid");
    reg.clear_child(unord_root, 0).expect("valid");
    assert!(reg.remove(ord_leaf).is_ok());
    assert!(reg.remove(unord_leaf).is_ok());
}

#[test]
fn a_removed_table_comes_back_as_a_usable_trait_object() {
    // `remove` hands back `Box<dyn TableTrait>` rather than the concrete type, so
    // the rows are still readable without knowing which table it was.
    let (mut reg, root, _, _) = hierarchy(0);
    reg.get_mut(root)
        .expect("registered")
        .append_row(row("kept"))
        .expect("valid row");

    let removed = reg.remove(root).expect("unreferenced");
    assert_eq!(removed.nrows(), 1);
    assert_eq!(removed.row(0).expect("row exists")[0], Value::Str("kept".to_string()));
}

#[test]
fn iteration_skips_deleted_tables() {
    let (mut reg, root, a, b) = hierarchy(0);
    assert_eq!(reg.ids().collect::<Vec<_>>(), vec![root, a, b]);
    reg.remove(a).expect("unreferenced");
    assert_eq!(reg.ids().collect::<Vec<_>>(), vec![root, b]);
    assert_eq!(reg.iter().count(), 2);
}

#[test]
fn a_hierarchy_is_torn_down_in_dependency_order() {
    let (mut reg, root, a, b) = hierarchy(2);
    reg.set_child(root, 0, a).expect("valid");
    reg.set_child(root, 1, b).expect("valid");

    // Children are protected while the parent links to them.
    assert!(reg.remove(a).is_err());
    assert!(reg.remove(b).is_err());
    // The parent, referenced by nothing, could go at any time.
    assert_eq!(reg.references(root), Ok(0));

    for row in 0..2 {
        reg.clear_child(root, row).expect("valid");
    }
    assert!(reg.remove(a).is_ok());
    assert!(reg.remove(b).is_ok());
    assert!(reg.remove(root).is_ok());
    assert!(reg.is_empty());
}
