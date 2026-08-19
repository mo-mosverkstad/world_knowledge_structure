//! Allocation of stable indices with reuse of freed ones.

use crate::data_structures::error::{StructureError, StructureResult};

/// Hands out indices that stay valid until freed, reusing freed ones first.
///
/// Which freed slot is reused is unspecified beyond being deterministic, so the
/// free list is a stack: `O(1)` free and reuse.
#[derive(Debug, Clone, Default)]
pub struct SlotAllocator {
    /// Indexed by slot; separate from `free` to keep `is_live` `O(1)`.
    live: Vec<bool>,
    free: Vec<usize>,
}

impl SlotAllocator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of live slots.
    pub fn len(&self) -> usize {
        self.live.len() - self.free.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// One past the highest slot ever handed out, i.e. the length storage indexed
    /// by these slots must reach. Freed slots stay allocated, so this exceeds
    /// [`len`](Self::len).
    pub fn capacity(&self) -> usize {
        self.live.len()
    }

    pub fn is_live(&self, slot: usize) -> bool {
        self.live.get(slot).copied().unwrap_or(false)
    }

    /// Reuses a freed slot if any, otherwise extends the index space.
    pub fn allocate(&mut self) -> StructureResult<usize> {
        if let Some(slot) = self.free.pop() {
            self.live[slot] = true;
            return Ok(slot);
        }
        let slot = self.live.len();
        if slot == usize::MAX {
            return Err(StructureError::CapacityExceeded);
        }
        self.live.push(true);
        Ok(slot)
    }

    /// Rejects a slot that is not live, so a double free cannot alias two entries
    /// onto one storage location.
    pub fn free(&mut self, slot: usize) -> StructureResult<()> {
        if !self.is_live(slot) {
            return Err(StructureError::IndexOutOfBounds {
                index: slot,
                len: self.live.len(),
            });
        }
        self.live[slot] = false;
        self.free.push(slot);
        Ok(())
    }

    /// Invalidates every slot handed out; the storage must be cleared too.
    pub fn clear(&mut self) {
        self.live.clear();
        self.free.clear();
    }

    /// Live slots in storage order, which after reuse is unrelated to the order
    /// they were handed out.
    pub fn live_slots(&self) -> impl Iterator<Item = usize> + '_ {
        self.live
            .iter()
            .enumerate()
            .filter_map(|(slot, &live)| live.then_some(slot))
    }
}
