mod demos;
mod domain;
mod statemanager;

use std::error::Error;

use demos::basic_history_demo::basic_history_demo;
use demos::table_demo::table_demo;
use demos::tree_array_demo::tree_array_demo;

/// `main` is the only place where the independent layers meet, so it is also the
/// only place that has to accept more than one error type. Neither layer panics
/// on invalid input: every failure arrives here as an error value, is reported,
/// and is turned into a non-zero exit code.
fn main() {
    if let Err(err) = run() {
        eprintln!("error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    // Domain layer demos: fail with `DomainError`.
    tree_array_demo()?;
    table_demo()?;
    // State manager demo: fails with `StatemanagerError`.
    basic_history_demo()?;
    Ok(())
}
