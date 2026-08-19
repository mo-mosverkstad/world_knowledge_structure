//! The cell type holding a link to a child table.

/// A cell in a child column: either a link to a table, or empty.
///
/// Nullable because a non-leaf table can have rows without children, and because
/// padding a column has to produce "no child" rather than a fabricated link to
/// table 0 — that would be an edge nobody created, and the reference counts would
/// disagree with reality.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct ChildLink(Option<usize>);

impl ChildLink {
    pub const EMPTY: Self = Self(None);

    /// Only the registry should build a populated link, since creating one is what
    /// the reference counts track.
    pub(crate) fn to(table: usize) -> Self {
        Self(Some(table))
    }

    pub fn target(self) -> Option<usize> {
        self.0
    }

    pub fn is_empty(self) -> bool {
        self.0.is_none()
    }

    /// Named to avoid colliding with `CellType::display`, which calls this.
    pub fn render(self) -> String {
        match self.0 {
            Some(table) => format!("->{table}"),
            None => String::new(),
        }
    }
}
