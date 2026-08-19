//! Entry point for the `domain` layer test target.
//!
//! Cargo only treats files directly under `tests/` as test targets, so this file
//! pulls in the parallel `tests/domain/` tree, which mirrors `src/domain/`
//! one-to-one.

mod domain {
    mod ordered_table;
    mod table_column;
    mod table_rows;
    mod treearray;
    mod unordered_table;
}
