mod core;

use core::treearray::TreeArray;

fn main() {
    let mut t = TreeArray::<u8>::new();
    t.append(3);
    t.append(55);
    t.append(77);
    t.append(33);
    t.append(23);
    t.append(120);
    t.append(73);
    t.append(54);
    t.append(67);
    t.append(220);
    t.append(232);
    println!("Array: {:?}", t.in_order());
}
