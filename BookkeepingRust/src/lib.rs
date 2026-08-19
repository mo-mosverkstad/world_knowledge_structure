//! Core logic, exposed as a library so tests can live in the parallel `tests/`
//! directory. `src/main.rs` is a thin binary on top.
//!
//! `domain` and `statemanager` are independent of each other; both sit above
//! `data_structures`, which never depends on them.

pub mod data_structures;
pub mod demos;
pub mod domain;
pub mod statemanager;
