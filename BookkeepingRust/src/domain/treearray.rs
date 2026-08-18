use std::fmt::Debug;

use crate::domain::error::{DomainError, DomainResult};

// ----------------------------- AVL Node -----------------------------
#[derive(Debug, Clone)]
struct Node<T> {
    value: T,
    size: usize,   // subtree size
    height: usize, // height of subtree
    left: Option<Box<Node<T>>>,
    right: Option<Box<Node<T>>>,
}

impl<T> Node<T> {
    fn new(value: T) -> Self {
        Self {
            value,
            size: 1,
            height: 1,
            left: None,
            right: None,
        }
    }

    fn update(&mut self) {
        let lh = self.left.as_ref().map_or(0, |l| l.height);
        let rh = self.right.as_ref().map_or(0, |r| r.height);
        self.height = 1 + lh.max(rh);

        let ls = self.left.as_ref().map_or(0, |l| l.size);
        let rs = self.right.as_ref().map_or(0, |r| r.size);
        self.size = 1 + ls + rs;
    }

    fn balance_factor(&self) -> isize {
        let lh = self.left.as_ref().map_or(0, |l| l.height as isize);
        let rh = self.right.as_ref().map_or(0, |r| r.height as isize);
        lh - rh
    }
}

// ----------------------------- TreeArray (AVL) -----------------------------
#[derive(Debug, Clone)]
pub struct TreeArray<T> {
    root: Option<Box<Node<T>>>,
}

#[allow(dead_code)]
impl<T: Copy + Clone + Debug> TreeArray<T> {
    pub fn new() -> Self {
        Self { root: None }
    }

    pub fn len(&self) -> usize {
        self.root.as_ref().map_or(0, |n| n.size)
    }

    pub fn is_empty(&self) -> bool {
        self.root.is_none()
    }

    // Public interface
    /// Absent indices yield `None`; use `try_get` when the caller should treat a
    /// missing index as an error to propagate.
    pub fn get(&self, idx: usize) -> Option<T> {
        self.get_ref(idx).cloned()
    }

    pub fn get_ref(&self, idx: usize) -> Option<&T> {
        Self::get_node_ref(&self.root, idx)
    }

    pub fn try_get(&self, idx: usize) -> DomainResult<T> {
        self.get(idx).ok_or(DomainError::IndexOutOfBounds {
            index: idx,
            len: self.len(),
        })
    }

    /// Replaces the value at `idx`, returning the previous value.
    pub fn set(&mut self, idx: usize, value: T) -> DomainResult<T> {
        let len = self.len();
        Self::set_node(&mut self.root, idx, value)
            .ok_or(DomainError::IndexOutOfBounds { index: idx, len })
    }

    pub fn append(&mut self, value: T) {
        // `len()` is always a valid insertion point, so this cannot fail.
        // It must be read before `take()` empties the tree.
        let idx = self.len();
        self.root = Self::insert_node(self.root.take(), idx, value);
    }

    pub fn pop(&mut self) -> Option<T> {
        let idx = self.len().checked_sub(1)?;
        let val = self.get(idx)?;
        self.root = Self::delete_node(self.root.take(), idx);
        Some(val)
    }

    /// Inserts before the element at `idx`. `idx == len()` appends.
    pub fn insert(&mut self, idx: usize, value: T) -> DomainResult<()> {
        let len = self.len();
        if idx > len {
            return Err(DomainError::IndexOutOfBounds { index: idx, len });
        }
        self.root = Self::insert_node(self.root.take(), idx, value);
        Ok(())
    }

    pub fn delete(&mut self, idx: usize) -> DomainResult<()> {
        let len = self.len();
        if idx >= len {
            return Err(DomainError::IndexOutOfBounds { index: idx, len });
        }
        self.root = Self::delete_node(self.root.take(), idx);
        Ok(())
    }

    pub fn clear(&mut self) {
        self.root = None
    }

    // ------------------ AVL helpers ------------------
    fn get_node_ref(node: &Option<Box<Node<T>>>, idx: usize) -> Option<&T> {
        let node = node.as_ref()?;
        let left_size = node.left.as_ref().map_or(0, |l| l.size);
        if idx < left_size {
            Self::get_node_ref(&node.left, idx)
        } else if idx == left_size {
            Some(&node.value)
        } else {
            Self::get_node_ref(&node.right, idx - left_size - 1)
        }
    }

    fn set_node(node: &mut Option<Box<Node<T>>>, idx: usize, value: T) -> Option<T> {
        let node = node.as_mut()?;
        let left_size = node.left.as_ref().map_or(0, |left| left.size);
        if idx < left_size {
            Self::set_node(&mut node.left, idx, value)
        } else if idx == left_size {
            Some(std::mem::replace(&mut node.value, value))
        } else {
            Self::set_node(&mut node.right, idx - left_size - 1, value)
        }
    }

    /// Rotations are only reached when the pivot child exists; if the invariant
    /// were ever violated the node is returned unchanged rather than panicking.
    fn rotate_right(mut y: Box<Node<T>>) -> Box<Node<T>> {
        let Some(mut x) = y.left.take() else {
            y.update();
            return y;
        };
        y.left = x.right.take();
        y.update();
        x.right = Some(y);
        x.update();
        x
    }

    fn rotate_left(mut x: Box<Node<T>>) -> Box<Node<T>> {
        let Some(mut y) = x.right.take() else {
            x.update();
            return x;
        };
        x.right = y.left.take();
        x.update();
        y.left = Some(x);
        y.update();
        y
    }

    fn balance(mut node: Box<Node<T>>) -> Box<Node<T>> {
        node.update();
        let bf = node.balance_factor();
        if bf > 1 {
            // Left heavy: rotate the left child first on a left-right shape.
            if let Some(left) = node.left.take() {
                node.left = Some(if left.balance_factor() < 0 {
                    Self::rotate_left(left)
                } else {
                    left
                });
            }
            return Self::rotate_right(node);
        } else if bf < -1 {
            // Right heavy: rotate the right child first on a right-left shape.
            if let Some(right) = node.right.take() {
                node.right = Some(if right.balance_factor() > 0 {
                    Self::rotate_right(right)
                } else {
                    right
                });
            }
            return Self::rotate_left(node);
        }
        node
    }

    fn insert_node(node: Option<Box<Node<T>>>, idx: usize, value: T) -> Option<Box<Node<T>>> {
        let mut node = match node {
            Some(n) => n,
            None => return Some(Box::new(Node::new(value))),
        };
        let left_size = node.left.as_ref().map_or(0, |l| l.size);
        if idx <= left_size {
            node.left = Self::insert_node(node.left.take(), idx, value);
        } else {
            node.right = Self::insert_node(node.right.take(), idx - left_size - 1, value);
        }
        Some(Self::balance(node))
    }

    fn delete_node(node: Option<Box<Node<T>>>, idx: usize) -> Option<Box<Node<T>>> {
        let mut node = node?;
        let left_size = node.left.as_ref().map_or(0, |l| l.size);
        if idx < left_size {
            node.left = Self::delete_node(node.left.take(), idx);
        } else if idx > left_size {
            node.right = Self::delete_node(node.right.take(), idx - left_size - 1);
        } else {
            // Node to remove
            if node.left.is_none() {
                return node.right;
            }
            match node.right.take() {
                None => return node.left,
                Some(right) => {
                    let (min_val, new_right) = Self::take_min(right);
                    node.value = min_val;
                    node.right = new_right;
                }
            }
        }
        Some(Self::balance(node))
    }

    fn take_min(mut node: Box<Node<T>>) -> (T, Option<Box<Node<T>>>) {
        match node.left.take() {
            None => (node.value, node.right.take()),
            Some(left) => {
                let (min_val, new_left) = Self::take_min(left);
                node.left = new_left;
                (min_val, Some(Self::balance(node)))
            }
        }
    }

    // -----------------In order --------------------

    pub fn in_order(&self) -> Vec<T> {
        // Backed by the lazy iterator: one O(log n) seek plus O(1) per element.
        self.iter().cloned().collect()
    }

    // ----------------- Lazy iteration --------------------

    /// Lazily walks the elements in index order without materialising them.
    ///
    /// Cost is `O(log n)` to reach the first element plus amortised `O(1)` per
    /// step, so reading `m` consecutive elements is `O(log n + m)`. Repeated
    /// `get(i)` calls instead cost `O(m log n)`, because every lookup restarts
    /// the descent from the root.
    pub fn iter(&self) -> TreeArrayIter<'_, T> {
        self.iter_from(0)
    }

    /// Like [`iter`](Self::iter) but starts at `start`, which is the form that
    /// replaces a run of `get(start..)` lookups. A `start` at or beyond `len()`
    /// yields an empty iterator, mirroring slice semantics.
    pub fn iter_from(&self, start: usize) -> TreeArrayIter<'_, T> {
        TreeArrayIter::new(self.root.as_deref(), start, self.len())
    }

    /// Lazily walks `count` elements starting at `index`, the direct replacement
    /// for a loop of `try_get` calls over a known range.
    ///
    /// The range is validated up front so an out-of-bounds request is reported
    /// before any element is produced, rather than surfacing mid-iteration.
    pub fn range(&self, index: usize, count: usize) -> DomainResult<TreeArrayIter<'_, T>> {
        let len = self.len();
        // `index == len` is valid only for an empty range (the position just past
        // the end), matching how `insert` treats `len` as a valid position.
        if index > len {
            return Err(DomainError::IndexOutOfBounds { index, len });
        }
        if count > len - index {
            // Report the first index the caller asked for that does not exist.
            return Err(DomainError::IndexOutOfBounds { index: len, len });
        }
        Ok(TreeArrayIter::new(self.root.as_deref(), index, index + count))
    }

    // ------------------ Pretty print ------------------
    pub fn pretty_print(&self) {
        fn recurse<T: Debug>(node: &Option<Box<Node<T>>>, prefix: String, is_left: bool) {
            if let Some(n) = node {
                println!(
                    "{}{}- [{:?}] size:{} height:{}",
                    prefix,
                    if is_left { "L" } else { "R" },
                    n.value,
                    n.size,
                    n.height
                );
                let new_prefix = prefix.clone() + if is_left { "|  " } else { "   " };
                recurse(&n.left, new_prefix.clone(), true);
                recurse(&n.right, new_prefix, false);
            }
        }
        println!("TreeArray structure:");
        recurse(&self.root, "".to_string(), false);
    }
}

// ----------------------------- Lazy in-order iterator -----------------------------

/// Lazy in-order iterator over a [`TreeArray`].
///
/// The iterator keeps the path from the root down to the current element on an
/// explicit stack instead of restarting the descent for every element:
///
/// * construction seeks to the start index in `O(log n)`, pushing at most
///   `height` ancestors;
/// * each [`Iterator::next`] pops one node and, when it has a right subtree,
///   descends that subtree's left spine.
///
/// Every edge is pushed and popped at most once across a full traversal, so the
/// per-step cost is amortised `O(1)` and reading `m` elements costs
/// `O(log n + m)`. The stack never exceeds the tree height, which the AVL
/// balancing keeps at `O(log n)`, so memory is `O(log n)` regardless of `m`.
///
/// Borrowing the tree immutably means the structure cannot be modified while an
/// iterator is alive, so the cached path cannot go stale.
pub struct TreeArrayIter<'a, T> {
    /// Ancestors whose values have not been yielded yet, nearest last.
    stack: Vec<&'a Node<T>>,
    /// Index of the next element to yield.
    next_idx: usize,
    /// One past the last index to yield.
    end_idx: usize,
}

impl<'a, T> TreeArrayIter<'a, T> {
    /// Seeks to `start` in `O(log n)`, leaving the stack holding exactly the
    /// ancestors whose values are still pending.
    fn new(root: Option<&'a Node<T>>, start: usize, end: usize) -> Self {
        let mut iter = Self {
            stack: Vec::new(),
            next_idx: start,
            end_idx: end,
        };
        if start >= end {
            // Empty range: leave the stack empty so `next` returns `None`.
            return iter;
        }

        // Descend once, keeping only the nodes that still have to be yielded. A
        // node is pushed when the target is in its left subtree or is the node
        // itself; when the target is to the right, the node and its left subtree
        // are already behind us and are skipped.
        let mut node = root;
        let mut rank = start;
        while let Some(n) = node {
            let left_size = n.left.as_ref().map_or(0, |l| l.size);
            if rank < left_size {
                iter.stack.push(n);
                node = n.left.as_deref();
            } else if rank == left_size {
                iter.stack.push(n);
                break;
            } else {
                rank -= left_size + 1;
                node = n.right.as_deref();
            }
        }
        iter
    }

    /// Pushes the left spine of `node`, so the smallest pending index ends up on
    /// top of the stack.
    fn push_left_spine(&mut self, node: Option<&'a Node<T>>) {
        let mut node = node;
        while let Some(n) = node {
            self.stack.push(n);
            node = n.left.as_deref();
        }
    }

    /// Number of elements the iterator has still to yield.
    fn remaining(&self) -> usize {
        self.end_idx.saturating_sub(self.next_idx)
    }
}

impl<'a, T> Iterator for TreeArrayIter<'a, T> {
    type Item = &'a T;

    fn next(&mut self) -> Option<Self::Item> {
        if self.next_idx >= self.end_idx {
            return None;
        }
        let node = self.stack.pop()?;
        // The successor is the left spine of the right subtree, or, when there is
        // no right subtree, the nearest pending ancestor already on the stack.
        self.push_left_spine(node.right.as_deref());
        self.next_idx += 1;
        Some(&node.value)
    }

    /// Exact, because the range is known up front; lets callers size buffers in
    /// one allocation.
    fn size_hint(&self) -> (usize, Option<usize>) {
        let remaining = self.remaining();
        (remaining, Some(remaining))
    }
}

impl<'a, T> ExactSizeIterator for TreeArrayIter<'a, T> {}

impl<'a, T: Copy + Clone + Debug> IntoIterator for &'a TreeArray<T> {
    type Item = &'a T;
    type IntoIter = TreeArrayIter<'a, T>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}
