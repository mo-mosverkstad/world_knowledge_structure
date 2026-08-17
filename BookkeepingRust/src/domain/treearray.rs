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
        let mut result = Vec::with_capacity(self.len());
        fn recurse<T: Clone>(node: &Option<Box<Node<T>>>, result: &mut Vec<T>) {
            if let Some(n) = node {
                recurse(&n.left, result);
                result.push(n.value.clone());
                recurse(&n.right, result);
            }
        }
        recurse(&self.root, &mut result);
        result
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn out_of_range_access_returns_error() {
        let mut t = TreeArray::<u8>::new();
        t.append(1);

        assert_eq!(
            t.try_get(5),
            Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
        );
        assert_eq!(
            t.set(5, 9),
            Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
        );
        assert_eq!(
            t.delete(5),
            Err(DomainError::IndexOutOfBounds { index: 5, len: 1 })
        );
        assert_eq!(
            t.insert(9, 9),
            Err(DomainError::IndexOutOfBounds { index: 9, len: 1 })
        );
        // The rejected operations left the tree untouched.
        assert_eq!(t.in_order(), vec![1]);
    }

    #[test]
    fn empty_tree_operations_do_not_panic() {
        let mut t = TreeArray::<u8>::new();
        assert!(t.is_empty());
        assert_eq!(t.pop(), None);
        assert_eq!(t.get(0), None);
        assert!(t.delete(0).is_err());
        assert!(t.insert(0, 7).is_ok()); // idx == len is a valid append
        assert_eq!(t.in_order(), vec![7]);
    }

    #[test]
    fn insert_delete_keeps_order_and_balance() {
        let mut t = TreeArray::<u16>::new();
        for v in 0..64u16 {
            t.append(v);
        }
        for _ in 0..32 {
            t.delete(0).expect("front element exists");
        }
        assert_eq!(t.len(), 32);
        assert_eq!(t.in_order(), (32..64u16).collect::<Vec<_>>());

        t.insert(0, 999).expect("front is a valid insertion point");
        let len = t.len();
        t.insert(len, 1000).expect("len is a valid insertion point");
        assert_eq!(t.try_get(0), Ok(999));
        assert_eq!(t.try_get(len), Ok(1000));
    }
}
