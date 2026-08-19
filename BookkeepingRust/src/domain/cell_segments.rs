//! Cell segments: the contents of one cell, split into ordered parts.

use crate::domain::error::{DomainError, DomainResult};

/// One or more ordered segments making up a single cell's contents.
///
/// The first segment is stored separately from the rest, so a segment count of
/// zero is unrepresentable rather than merely rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Segments {
    head: String,
    rest: Vec<String>,
}

impl Segments {
    /// A cell of exactly one segment.
    pub fn one(segment: impl Into<String>) -> Self {
        Self {
            head: segment.into(),
            rest: Vec::new(),
        }
    }

    /// Fails with [`DomainError::EmptyCell`] on an empty input rather than
    /// inventing a segment.
    pub fn new(segments: Vec<String>) -> DomainResult<Self> {
        let mut segments = segments.into_iter();
        let head = segments.next().ok_or(DomainError::EmptyCell)?;
        Ok(Self {
            head,
            rest: segments.collect(),
        })
    }

    /// Always at least 1.
    pub fn len(&self) -> usize {
        1 + self.rest.len()
    }

    /// Always `false`; provided because a bare `len` invites the comparison.
    pub fn is_empty(&self) -> bool {
        false
    }

    pub fn get(&self, idx: usize) -> DomainResult<&str> {
        match idx {
            0 => Ok(&self.head),
            _ => self
                .rest
                .get(idx - 1)
                .map(String::as_str)
                .ok_or(DomainError::IndexOutOfBounds {
                    index: idx,
                    len: self.len(),
                }),
        }
    }

    pub fn set(&mut self, idx: usize, segment: impl Into<String>) -> DomainResult<String> {
        let slot = match idx {
            0 => &mut self.head,
            _ => {
                let len = self.len();
                self.rest
                    .get_mut(idx - 1)
                    .ok_or(DomainError::IndexOutOfBounds { index: idx, len })?
            }
        };
        Ok(std::mem::replace(slot, segment.into()))
    }

    pub fn push(&mut self, segment: impl Into<String>) {
        self.rest.push(segment.into());
    }

    /// `idx == len()` appends.
    pub fn insert(&mut self, idx: usize, segment: impl Into<String>) -> DomainResult<()> {
        let len = self.len();
        if idx > len {
            return Err(DomainError::IndexOutOfBounds { index: idx, len });
        }
        if idx == 0 {
            let displaced = std::mem::replace(&mut self.head, segment.into());
            self.rest.insert(0, displaced);
        } else {
            self.rest.insert(idx - 1, segment.into());
        }
        Ok(())
    }

    /// Refuses to remove the only segment, naming `column` in the error.
    ///
    /// Removing segment 0 promotes the next one to first.
    pub fn remove(&mut self, idx: usize, column: &str) -> DomainResult<String> {
        if self.len() == 1 {
            return Err(DomainError::LastSegment {
                column: column.to_string(),
            });
        }
        if idx >= self.len() {
            return Err(DomainError::IndexOutOfBounds {
                index: idx,
                len: self.len(),
            });
        }
        if idx == 0 {
            let promoted = self.rest.remove(0);
            Ok(std::mem::replace(&mut self.head, promoted))
        } else {
            Ok(self.rest.remove(idx - 1))
        }
    }

    /// Replaces every segment, keeping the cell non-empty.
    pub fn replace_all(&mut self, segments: Vec<String>) -> DomainResult<()> {
        *self = Self::new(segments)?;
        Ok(())
    }

    pub fn iter(&self) -> impl Iterator<Item = &str> {
        std::iter::once(self.head.as_str()).chain(self.rest.iter().map(String::as_str))
    }

    pub fn first(&self) -> &str {
        &self.head
    }
}

impl<'a> IntoIterator for &'a Segments {
    type Item = &'a str;
    type IntoIter = Box<dyn Iterator<Item = &'a str> + 'a>;

    fn into_iter(self) -> Self::IntoIter {
        Box::new(self.iter())
    }
}
