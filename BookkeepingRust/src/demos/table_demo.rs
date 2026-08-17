use crate::domain::table_column::Value;
use crate::domain::table_column::TableColumn;
use crate::domain::table_trait::TableTrait;
use crate::domain::ordered_table::OrderedTable;
use crate::domain::unordered_table::UnorderedTable;


pub fn table_demo() {
    println!(" ------------------------------- Table Demo ------------------------------- ");
    // Ordered example
    let mut ord = OrderedTable::new();
    ord.add_column(TableColumn::<i32>::new("Age"));
    ord.add_column(TableColumn::<String>::new("Name"));
    ord.add_column(TableColumn::<f32>::new("Salary"));
    ord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)]);
    ord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)]);
    println!("OrderedTable:");
    ord.print_table();

    // Unordered example using TreeArray + recycling
    let mut unord = UnorderedTable::new();
    unord.add_column(TableColumn::<i32>::new("Age"));
    unord.add_column(TableColumn::<String>::new("Name"));
    unord.add_column(TableColumn::<f32>::new("Salary"));

    // append two rows
    unord.append_row(vec![Value::Int(25), Value::Str("Alice".to_string()), Value::Float(50000.0)]);
    unord.append_row(vec![Value::Int(30), Value::Str("Bob".to_string()), Value::Float(60000.0)]);
    println!("\nUnorderedTable after appends:");
    unord.print_table();

    // insert at logical index 1
    unord.insert_row(1, vec![Value::Int(22), Value::Str("Elina".to_string()), Value::Float(59929.0)]);
    println!("\nAfter insert at logical idx 1:");
    unord.print_table();

    // delete logical index 0 -> frees a physical slot
    unord.delete_row(0);
    println!("\nAfter delete logical idx 0 (frees physical slot):");
    unord.print_table();
    println!("Next physical index: {}", unord.get_next_physical_index());
    println!("Free physical set: {:?}", unord.get_free_physical());

    // insert again (should reuse freed physical index)
    unord.insert_row(1, vec![Value::Int(27), Value::Str("Sam".to_string()), Value::Float(48000.0)]);
    println!("\nAfter insert at logical idx 0 (should reuse freed physical slot):");
    unord.print_table();
    println!("Next physical index: {}", unord.get_next_physical_index());
    println!("Free physical set: {:?}", unord.get_free_physical());

    // swap rows 0 and 2
    unord.swap_rows(0, 2);
    println!("\nAfter swap rows 0 and 2:");
    unord.print_table();

    // update row
    unord.update_row(1, vec![Value::Int(99), Value::Str("Updated".to_string()), Value::Float(12345.0)]);
    println!("\nAfter update logical row 1:");
    unord.print_table();

    // show internal mapping & recycling info
    println!("\nInternal logical->physical (in-order): {:?}", unord.get_logical_order().in_order());
    println!("Next physical index: {}", unord.get_next_physical_index());
    println!("Free physical set: {:?}", unord.get_free_physical());

    println!(" ------------------------------------------------------------------------------- \n");
}