//! Thin binary entry point. All logic lives in the `bookkeeping_rust` library
//! (see `src/lib.rs`) so that it can be exercised from the `tests/` directory.

use std::error::Error;

use bookkeeping_rust::demos::basic_history_demo::basic_history_demo;
use bookkeeping_rust::demos::cell_segments_demo::cell_segments_demo;
use bookkeeping_rust::demos::table_demo::table_demo;
use bookkeeping_rust::demos::table_registry_demo::table_registry_demo;
use bookkeeping_rust::demos::tree_array_demo::tree_array_demo;
use bookkeeping_rust::tui_view::tui_view::ncursesdemo;

/// `main` is the only place where the independent layers meet, so it is also the
/// only place that has to accept more than one error type. Neither layer panics
/// on invalid input: every failure arrives here as an error value, is reported,
/// and is turned into a non-zero exit code.
fn main() {
    if let Err(err) = run() {
        eprintln!("error: {err}");
        std::process::exit(1);
    }
    // suppress TUI demo by now
    // ncursesdemo();
}



fn run() -> Result<(), Box<dyn Error>> {
    // Domain layer demos: fail with `DomainError`.
    tree_array_demo()?;
    table_demo()?;
    cell_segments_demo()?;
    table_registry_demo()?;
    // State manager demo: fails with `StatemanagerError`.
    basic_history_demo()?;
    Ok(())
}
