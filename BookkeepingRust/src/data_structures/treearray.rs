use std::fmt::Debug;
use std::ops::{Range, RangeBounds};

use crate::data_structures::error::{StructureError, StructureResult};
use crate::data_structures::index_range::resolve_range;

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
    /// Absent indices yield `None`; `try_get` reports them as an error instead.
    pub fn get(&self, idx: usize) -> Option<T> {
        self.get_ref(idx).cloned()
    }

    pub fn get_ref(&self, idx: usize) -> Option<&T> {
        Self::get_node_ref(&self.root, idx)
    }

    pub fn try_get(&self, idx: usize) -> StructureResult<T> {
        self.get(idx).ok_or(StructureError::IndexOutOfBounds {
            index: idx,
            len: self.len(),
        })
    }

    /// Replaces the value at `idx`, returning the previous value.
    pub fn set(&mut self, idx: usize, value: T) -> StructureResult<T> {
        let len = self.len();
        Self::set_node(&mut self.root, idx, value)
            .ok_or(StructureError::IndexOutOfBounds { index: idx, len })
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
    pub fn insert(&mut self, idx: usize, value: T) -> StructureResult<()> {
        let len = self.len();
        if idx > len {
            return Err(StructureError::IndexOutOfBounds { index: idx, len });
        }
        self.root = Self::insert_node(self.root.take(), idx, value);
        Ok(())
    }

    pub fn delete(&mut self, idx: usize) -> StructureResult<()> {
        let len = self.len();
        if idx >= len {
            return Err(StructureError::IndexOutOfBounds { index: idx, len });
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

    /// Returns the node unchanged if the pivot child is absent, rather than
    /// panicking.
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

    /// Lazily walks every element in index order.
    ///
    /// `O(log n)` to the first element plus amortised `O(1)` per step, so reading
    /// `m` elements is `O(log n + m)` against `O(m log n)` for repeated `get`.
    pub fn iter(&self) -> TreeArrayIter<'_, T> {
        // `..` covers the whole tree and is valid by construction.
        TreeArrayIter::new(self.root.as_deref(), 0..self.len())
    }

    /// Lazily walks the elements in `range`, accepting any Rust range syntax and
    /// validating it up front. `range(..)` always succeeds.
    pub fn range<R: RangeBounds<usize>>(&self, range: R) -> StructureResult<TreeArrayIter<'_, T>> {
        let range = resolve_range(range, self.len())?;
        Ok(TreeArrayIter::new(self.root.as_deref(), range))
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
/// Keeps the root-to-current path on a stack rather than re-descending per
/// element: every edge is pushed and popped at most once, so steps are amortised
/// `O(1)` and memory is `O(log n)`.
pub struct TreeArrayIter<'a, T> {
    /// Ancestors whose values have not been yielded yet, nearest last.
    stack: Vec<&'a Node<T>>,
    /// Indices still to yield.
    pending: Range<usize>,
}

impl<'a, T> TreeArrayIter<'a, T> {
    /// Seeks to the start of `pending` in `O(log n)`. The range must already be
    /// validated, hence private.
    fn new(root: Option<&'a Node<T>>, pending: Range<usize>) -> Self {
        let mut iter = Self {
            stack: Vec::new(),
            pending: pending.clone(),
        };
        if pending.is_empty() {
            // Empty range: leave the stack empty so `next` returns `None`.
            return iter;
        }

        // Push only nodes still to be yielded: when the target lies right, the node
        // and its left subtree are already behind us.
        let mut node = root;
        let mut rank = pending.start;
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

    /// Pushes the left spine, putting the smallest pending index on top.
    fn push_left_spine(&mut self, node: Option<&'a Node<T>>) {
        let mut node = node;
        while let Some(n) = node {
            self.stack.push(n);
            node = n.left.as_deref();
        }
    }

    fn remaining(&self) -> usize {
        self.pending.len()
    }
}

impl<'a, T> Iterator for TreeArrayIter<'a, T> {
    type Item = &'a T;

    fn next(&mut self) -> Option<Self::Item> {
        // Advancing the range is what bounds the walk; `Range::next` yields
        // `None` once the window is exhausted.
        self.pending.next()?;
        let node = self.stack.pop()?;
        // The successor is the left spine of the right subtree, or, when there is
        // no right subtree, the nearest pending ancestor already on the stack.
        self.push_left_spine(node.right.as_deref());
        Some(&node.value)
    }

    /// Exact, since the range is known up front.
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
