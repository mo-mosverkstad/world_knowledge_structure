//! General-purpose data structures, independent of any business model.
//!
//! Nothing here knows about bookkeeping: no tables, columns, rows or undo/redo.
//! These are containers and index bookkeeping that happen to be used by the
//! `domain` layer, and could equally be used elsewhere. The dependency runs one
//! way only — `domain` uses `data_structures`, never the reverse — which is why
//! this module has its own [`error`] type rather than reporting a domain error.

pub mod error;
pub mod index_range;
pub mod treearray;
