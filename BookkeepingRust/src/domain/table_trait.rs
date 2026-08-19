use std::fmt::Debug;

use crate::domain::error::DomainResult;
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;

pub trait TableTrait: Debug {
    /// Lazy row iterator returned by the reading methods. Each table has its own
    /// way of sequencing physical indices, so the concrete type differs; all that
    /// callers rely on is that it yields rows in user order.
    type Rows<'a>: Iterator<Item = DomainResult<Vec<Value>>>
    where
        Self: 'a;

    fn add_column<C: Column + 'static>(&mut self, col: C);
    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()>;
    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()>;
    fn print_table(&self) -> DomainResult<()>;

    /// Number of rows in user-index order, i.e. the exclusive upper bound of a
    /// valid row index.
    fn nrows(&self) -> usize;

    /// Lazily reads every row, each yielded as the `Vec<Value>` it was fed to the
    /// table as.
    ///
    /// Rows are assembled one at a time, so a caller that stops early pays only
    /// for what it consumed. Prefer this over a loop of per-row lookups: on
    /// tables backed by a `TreeArray` the walk costs `O(log n + m)` for `m` rows
    /// instead of `O(m log n)`.
    fn iter_rows(&self) -> Self::Rows<'_>;

    /// Like [`iter_rows`](Self::iter_rows) but starts at user index `start`. A
    /// `start` at or beyond [`nrows`](Self::nrows) yields nothing, mirroring
    /// slice semantics.
    fn rows_from(&self, start: usize) -> Self::Rows<'_>;

    /// Lazily reads `count` rows starting at user index `index`, the direct
    /// replacement for a loop of single-row lookups over a known range.
    ///
    /// The range is validated up front, so an out-of-bounds request is reported
    /// before any row is produced rather than surfacing mid-iteration.
    fn row_range(&self, index: usize, count: usize) -> DomainResult<Self::Rows<'_>>;
}
