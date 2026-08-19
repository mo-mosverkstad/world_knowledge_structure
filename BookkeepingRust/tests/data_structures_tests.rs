//! Entry point for the `data_structures` layer test target.
//!
//! Cargo only treats files directly under `tests/` as test targets, so this file
//! pulls in the parallel `tests/data_structures/` tree, which mirrors
//! `src/data_structures/` one-to-one.

mod data_structures {
    mod index_range;
    mod treearray;
}
