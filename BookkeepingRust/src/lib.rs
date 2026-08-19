//! Core logic of the crate, exposed as a library so that tests can live in the
//! parallel `tests/` directory instead of being mixed into the implementation
//! files. `src/main.rs` is a thin binary on top of this library.
//!
//! The two top-level layers are deliberately independent: `domain` knows
//! nothing about undo/redo and `statemanager` knows nothing about tables or
//! trees. Only code that combines them (the demos, `main`) deals with both.
//!
//! `data_structures` sits below both: general-purpose containers with no
//! knowledge of any business model. The dependency runs one way only — `domain`
//! uses `data_structures`, never the reverse.

pub mod data_structures;
pub mod demos;
pub mod domain;
pub mod statemanager;
