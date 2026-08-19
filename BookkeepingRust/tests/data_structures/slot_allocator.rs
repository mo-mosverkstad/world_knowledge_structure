//! Tests for `data_structures::slot_allocator`.

use bookkeeping_rust::data_structures::error::StructureError;
use bookkeeping_rust::data_structures::slot_allocator::SlotAllocator;

#[test]
fn fresh_slots_are_handed_out_in_ascending_order() {
    let mut alloc = SlotAllocator::new();
    let slots: Vec<usize> = (0..5)
        .map(|_| alloc.allocate().expect("space available"))
        .collect();
    assert_eq!(slots, vec![0, 1, 2, 3, 4]);
    assert_eq!(alloc.len(), 5);
    assert_eq!(alloc.capacity(), 5);
}

#[test]
fn a_new_allocator_is_empty() {
    let alloc = SlotAllocator::new();
    assert_eq!(alloc.len(), 0);
    assert_eq!(alloc.capacity(), 0);
    assert!(alloc.is_empty());
    assert!(!alloc.is_live(0));
    assert_eq!(alloc.live_slots().count(), 0);
}

#[test]
fn a_freed_slot_is_reused_before_the_index_space_grows() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..3 {
        alloc.allocate().expect("space available");
    }
    alloc.free(1).expect("slot 1 is live");
    assert_eq!(alloc.len(), 2);
    // Freeing does not shrink the storage bound.
    assert_eq!(alloc.capacity(), 3);

    assert_eq!(alloc.allocate(), Ok(1));
    assert_eq!(alloc.capacity(), 3);
    assert_eq!(alloc.allocate(), Ok(3));
    assert_eq!(alloc.capacity(), 4);
}

#[test]
fn reuse_is_deterministic_and_does_not_grow_the_index_space() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..6 {
        alloc.allocate().expect("space available");
    }
    for slot in [4, 1, 3] {
        alloc.free(slot).expect("slot is live");
    }
    assert_eq!(alloc.capacity(), 6);

    let reused: Vec<usize> = (0..3)
        .map(|_| alloc.allocate().expect("a free slot is available"))
        .collect();

    let mut sorted = reused.clone();
    sorted.sort_unstable();
    assert_eq!(sorted, vec![1, 3, 4]);
    assert_eq!(alloc.capacity(), 6);
    // Only now that nothing is free does the space grow.
    assert_eq!(alloc.allocate(), Ok(6));
    assert_eq!(alloc.capacity(), 7);

    let mut again = SlotAllocator::new();
    for _ in 0..6 {
        again.allocate().expect("space available");
    }
    for slot in [4, 1, 3] {
        again.free(slot).expect("slot is live");
    }
    let repeated: Vec<usize> = (0..3)
        .map(|_| again.allocate().expect("a free slot is available"))
        .collect();
    assert_eq!(repeated, reused, "allocation must be reproducible");
}

#[test]
fn a_live_slot_is_never_handed_out_twice() {
    let mut alloc = SlotAllocator::new();
    let mut seen = Vec::new();
    for _ in 0..8 {
        seen.push(alloc.allocate().expect("space available"));
    }
    for slot in [0, 2, 7] {
        alloc.free(slot).expect("slot is live");
    }
    for _ in 0..3 {
        seen.push(alloc.allocate().expect("space available"));
    }

    let mut live: Vec<usize> = alloc.live_slots().collect();
    live.sort_unstable();
    let mut deduped = live.clone();
    deduped.dedup();
    assert_eq!(live, deduped, "no slot is live twice");
    assert_eq!(live.len(), alloc.len());
    assert_eq!(live, (0..8).collect::<Vec<_>>());
    assert_eq!(seen.len(), 11, "11 allocations over 8 slots");
}

#[test]
fn freeing_a_slot_twice_is_rejected() {
    let mut alloc = SlotAllocator::new();
    alloc.allocate().expect("space available");
    alloc.free(0).expect("slot 0 is live");
    assert_eq!(
        alloc.free(0),
        Err(StructureError::IndexOutOfBounds { index: 0, len: 1 })
    );
    // Rejected, so the slot is still handed out exactly once.
    assert_eq!(alloc.allocate(), Ok(0));
    assert_eq!(alloc.allocate(), Ok(1));
}

#[test]
fn freeing_a_slot_that_was_never_handed_out_is_rejected() {
    let mut alloc = SlotAllocator::new();
    alloc.allocate().expect("space available");
    assert_eq!(
        alloc.free(5),
        Err(StructureError::IndexOutOfBounds { index: 5, len: 1 })
    );
    assert_eq!(alloc.len(), 1);
    assert_eq!(alloc.allocate(), Ok(1));
}

#[test]
fn liveness_tracks_allocation_and_freeing() {
    let mut alloc = SlotAllocator::new();
    assert!(!alloc.is_live(0));
    alloc.allocate().expect("space available");
    assert!(alloc.is_live(0));
    alloc.free(0).expect("slot 0 is live");
    assert!(!alloc.is_live(0));
    alloc.allocate().expect("space available");
    assert!(alloc.is_live(0));
}

#[test]
fn a_reused_slot_becomes_live_again_in_every_respect() {
    // Liveness is tracked separately from the free list, so reuse must update both.
    let mut alloc = SlotAllocator::new();
    for _ in 0..3 {
        alloc.allocate().expect("space available");
    }
    alloc.free(1).expect("slot 1 is live");
    assert_eq!(alloc.len(), 2);

    let reused = alloc.allocate().expect("a free slot is available");
    assert_eq!(reused, 1);
    assert!(alloc.is_live(reused));
    assert_eq!(alloc.len(), 3);
    assert_eq!(alloc.live_slots().collect::<Vec<_>>(), vec![0, 1, 2]);
    assert!(alloc.free(reused).is_ok());
    assert!(alloc.free(reused).is_err(), "no double free");
}

#[test]
fn len_counts_live_slots_while_capacity_bounds_the_storage() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..5 {
        alloc.allocate().expect("space available");
    }
    for slot in [0, 1, 2] {
        alloc.free(slot).expect("slot is live");
    }
    assert_eq!(alloc.len(), 2);
    assert_eq!(alloc.capacity(), 5);
    assert_eq!(alloc.live_slots().collect::<Vec<_>>(), vec![3, 4]);
}

#[test]
fn freeing_everything_leaves_an_empty_but_non_zero_capacity_allocator() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..3 {
        alloc.allocate().expect("space available");
    }
    for slot in 0..3 {
        alloc.free(slot).expect("slot is live");
    }
    assert!(alloc.is_empty());
    assert_eq!(alloc.len(), 0);
    // Only `clear` gives the index space back.
    assert_eq!(alloc.capacity(), 3);
    assert_eq!(alloc.live_slots().count(), 0);

    let mut reused: Vec<usize> = (0..3)
        .map(|_| alloc.allocate().expect("a free slot is available"))
        .collect();
    reused.sort_unstable();
    assert_eq!(reused, vec![0, 1, 2]);
    assert_eq!(alloc.capacity(), 3);
}

#[test]
fn clear_restarts_allocation_from_zero() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..4 {
        alloc.allocate().expect("space available");
    }
    alloc.free(2).expect("slot 2 is live");
    alloc.clear();
    assert!(alloc.is_empty());
    assert_eq!(alloc.capacity(), 0);
    assert_eq!(alloc.allocate(), Ok(0));
}

#[test]
fn live_slots_are_reported_in_storage_order_not_allocation_order() {
    let mut alloc = SlotAllocator::new();
    for _ in 0..4 {
        alloc.allocate().expect("space available");
    }
    alloc.free(0).expect("slot 0 is live");
    alloc.free(2).expect("slot 2 is live");
    alloc.allocate().expect("a free slot is available");
    alloc.allocate().expect("a free slot is available");
    assert_eq!(alloc.live_slots().collect::<Vec<_>>(), vec![0, 1, 2, 3]);
}
