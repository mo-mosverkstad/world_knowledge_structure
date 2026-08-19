use std::fmt::Debug;
use std::ops::RangeBounds;

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
    ///
    /// This is the whole-table case of [`row_range`](Self::row_range) and cannot
    /// fail, so it returns the iterator directly.
    fn iter_rows(&self) -> Self::Rows<'_>;

    /// Lazily reads the rows in `range`, the direct replacement for a loop of
    /// single-row lookups over a known window.
    ///
    /// Any Rust range syntax works — `t.row_range(..)`, `t.row_range(5..)`,
    /// `t.row_range(..10)`, `t.row_range(2..=7)` — with the same bound checks in
    /// each case. The range is validated up front, so an out-of-bounds or
    /// malformed request is reported before any row is produced rather than
    /// surfacing mid-iteration. An omitted bound cannot be out of bounds, so
    /// `row_range(..)` always succeeds and is equivalent to
    /// [`iter_rows`](Self::iter_rows).
    fn row_range<R: RangeBounds<usize>>(&self, range: R) -> DomainResult<Self::Rows<'_>>;
}
