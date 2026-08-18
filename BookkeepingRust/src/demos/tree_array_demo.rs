use crate::domain::error::DomainResult;
use crate::domain::treearray::TreeArray;

pub fn tree_array_demo() -> DomainResult<()> {
    let mut t = TreeArray::<u8>::new();
    for value in [3, 55, 77, 33, 23, 120, 73, 54, 67, 220, 232] {
        t.append(value);
    }
    println!("Array: {:?}", t.in_order());

    // Fallible operations report an out-of-bounds index instead of panicking.
    t.insert(3, 99)?;
    t.delete(0)?;
    println!("After insert at 3 and delete at 0: {:?}", t.in_order());

    let out_of_range = t.len() + 5;
    match t.try_get(out_of_range) {
        Ok(value) => println!("Unexpected value at {out_of_range}: {value}"),
        Err(err) => println!("Recovered from bad index {out_of_range}: {err}"),
    }

    // Lazy iteration: one O(log n) seek plus O(1) per element, so reading a
    // window costs O(log n + m) instead of the O(m log n) of repeated `try_get`.
    let window: Vec<u8> = t.range(2, 4)?.copied().collect();
    println!("Lazy window of 4 elements from index 2: {window:?}");

    // Nothing is materialised until the values are pulled, so a short prefix of a
    // large tree does not pay for the whole traversal.
    let first_three: Vec<u8> = t.iter().copied().take(3).collect();
    println!("First three via lazy iterator: {first_three:?}");

    // An out-of-bounds window is rejected before any element is yielded.
    match t.range(t.len() - 1, 5) {
        Ok(_) => println!("Unexpected: oversized window was accepted"),
        Err(err) => println!("Rejected oversized window: {err}"),
    }

    let x = 58;
    let my_ref = &x;
    println!("my_ref = {:p}, *my_ref = {}", my_ref, *my_ref);
    Ok(())
}
