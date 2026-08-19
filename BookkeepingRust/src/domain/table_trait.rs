use std::fmt::Debug;
use std::ops::RangeBounds;

use crate::domain::error::DomainResult;
use crate::domain::table_column::Column;
use crate::domain::table_column::Value;

pub trait TableTrait: Debug {
    /// Concrete type differs per table, since each sequences physical indices its
    /// own way; all that callers rely on is that rows come in user order.
    type Rows<'a>: Iterator<Item = DomainResult<Vec<Value>>>
    where
        Self: 'a;

    fn add_column<C: Column + 'static>(&mut self, col: C);
    fn append_row(&mut self, row: Vec<Value>) -> DomainResult<()>;
    fn update_row(&mut self, idx: usize, row: Vec<Value>) -> DomainResult<()>;
    fn print_table(&self) -> DomainResult<()>;

    /// Exclusive upper bound of a valid row index.
    fn nrows(&self) -> usize;

    /// Lazily reads every row. On a `TreeArray`-backed table this costs
    /// `O(log n + m)` for `m` rows rather than `O(m log n)`.
    fn iter_rows(&self) -> Self::Rows<'_>;

    /// Lazily reads the rows in `range`, accepting any Rust range syntax and
    /// validating it up front. `row_range(..)` always succeeds and equals
    /// [`iter_rows`](Self::iter_rows).
    fn row_range<R: RangeBounds<usize>>(&self, range: R) -> DomainResult<Self::Rows<'_>>;
}
