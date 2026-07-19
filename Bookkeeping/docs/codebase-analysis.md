# Dynamic table data structure

I am considering to build a dynamic table in C/C++ and currently I decide to built it with as less metadata as possible since metadata consumes space. 

## Pool

Notice the following concepts regarding the dynamic table:

The pool is an important concept for the dynamic table with its own intended meaning. Essentially, a pool is an often large array containing concentrated homogeneous objects for better cache locality and stronger enforcement of memory hygiene. The size of the pool can vary and may be either static or dynamic. This is especially useful for linked data structures, where nodes are conventionally scattered throughout memory, leading to poor cache locality, memory fragmentation, and pollution of the memory space.

Operations on pools consist of insertion, deletion, and access. The exact implementation of these operations may vary depending on the pool type. There are two different pool types: structured pools and non-structured pools.

Structured pools are essentially the same as a vector, where the indices of the pool have semantic meaning. The only difference is that the pool contains linked data structure nodes. This means that insertion, deletion, and access depend on the host data structure implemented upon the pool. The data structure defines how the indices are utilized. For instance, if B+ tree leaf nodes are implemented upon the pool, the pool may be divided into 64 equally sized sections with 64 elements each.

For non-structured pools, indices are only relevant within the pool itself. While a node is stored, it is considered an alive node with index pointers to other nodes within the same pool. There are also dead nodes, which serve only as placeholders with an index pointer to the next dead node, effectively creating a linked list of free nodes. In this case, inserting a value into the pool can be translated as appending a node at the end of the array. Removing a value can be translated as replacing the node with a dead node and relinking it with the previous dead node.

## Dynamic table

The dynamic table holds a dynamically resizable table consisting of columns and rows. Each column has a fixed element size defined by the dynamic table collation. As usual, the table must support the basic functionalities such as row insertion, row deletion, row re-sorting, cell read, and cell write, as well as several advanced functionalities for convenience, including <Not specified yet...>. The aim of the dynamic table is to reduce as much program metadata as possible while achieving as much performance as possible.

There are two types of dynamic tables: ordered dynamic tables and unordered dynamic tables.

In ordered dynamic tables, each row is equipped with a unique key that can be compared against other keys. The order of the table is determined by the ascending order of the comparable unique key. As a result, row re-sorting cannot be allowed.

The other variant is the unordered dynamic table. In these tables, rows are not equipped with any key and can therefore be rearranged freely by the user, enabling the row re-sorting operation.

## Implementation plans

In terms of the actual implementation of the dynamic table, there are two proposed plans:

### Implementation 1

As a memory layout definition, the dynamic table struct consists of a number of control metadata variables (including the root alive tree node and the first dead tree node), one pointer to a heap-allocated non-structured pool for manager tree nodes, an in-struct collation storage array, and an in-struct array holding pointers to heap-allocated structured pools for column leaf nodes.

The manager tree contains the non-leaf nodes, whereas the columns contain the leaf nodes. The pointers in the manager tree are index pointers within the manager pool, except for semi-leaf nodes, whose pointers are index pointers into the corresponding column pool. The same column index across different pools represents the same row. The resulting tree structure is essentially a 64-way B+ tree.

If the number of rows grows beyond the current capacity of the dynamic table, the table is resized by resizing all heap-allocated pools, including the column storage pools and, less frequently, the manager tree pool, since the column storage grows much faster than the metadata stored in the manager tree. If the number of columns grows beyond the control block capacity, only the control block needs to be reallocated.

### Implementation 2

This implementation consists of an array of pointers to large root pool-node blocks used as column storage, where each pool-node block is itself a large 4096-element pool. Non-leaf pool-node blocks hold pointers, whereas leaf pool-node blocks hold the actual data. Since one pool-node block contains 4096 elements, it effectively represents a small two-layer subtree.

The size of 4096 elements is large enough to benefit from the advantages of a pool while keeping fragmentation low, yet small enough to preserve a grow-as-you-need allocation strategy.

The number of rows effectively does not exceed the row capacity, since this implementation does not impose an upper capacity limit on rows. However, if the number of columns grows beyond the capacity of the dynamic table, only a reallocation of the control block is required.

## Implementation analysis

Several conclusions can be drawn from the implementation plans.

One downside of Implementation 1 is the performance spike during resizing, despite its amortized constant-time complexity. This issue does not occur in Implementation 2, since it never resizes existing pools and therefore avoids reallocations as part of the dynamic table algorithm.

On the other hand, Implementation 2 suffers from additional pointer chasing during column traversal, increasing the cost of data access.

Add more implementation analysis...


---

Your analysis is already identifying the primary tradeoff (global contiguous storage vs. segmented storage), but there are a number of additional aspects worth evaluating. Some of them are actually more important than the amortized resize cost.

---

# Additional implementation analysis

## 1. Cache locality

### Implementation 1

Implementation 1 has nearly ideal spatial locality.

* Every column is one contiguous array.
* Sequential row scans become simple linear memory accesses.
* Hardware prefetchers work very efficiently.
* SIMD/vectorization becomes much easier.

For analytical workloads ("scan every row"), this implementation is difficult to outperform.

The manager tree is also stored as one pool, making traversal relatively cache friendly.

### Implementation 2

Locality depends on whether traversal remains inside one block.

Inside one 4096-element pool block:

* locality is excellent.

Crossing into another block requires

* loading another pointer,
* potentially another cache miss,
* another TLB lookup.

Large table scans therefore become slightly less efficient.

---

## 2. Memory fragmentation

### Implementation 1

Requires reallocating large contiguous arrays.

As tables become very large,

* obtaining another contiguous block becomes increasingly difficult,
* allocator pressure increases,
* external fragmentation may become noticeable.

Although realloc() may grow in place, this cannot be relied upon.

---

### Implementation 2

Each block is independently allocated.

Advantages:

* almost no need for huge contiguous allocations
* allocator can recycle blocks
* much more resilient on long-running programs

This is a significant practical advantage.

---

## 3. Resize latency

You already mentioned this, but there is another aspect.

Implementation 1 performs

```
O(number of columns)
```

large memory copies.

Even though amortized complexity is good, one resize may take milliseconds.

For interactive software or real-time systems this pause may be unacceptable.

Implementation 2 never exhibits such pauses.

Latency is therefore much more predictable.

---

## 4. Memory overhead

Implementation 1 stores

* one pointer per column
* manager tree nodes

Nothing else.

Metadata overhead is essentially minimal.

---

Implementation 2 additionally stores

* pointers between pool-node blocks
* partially filled blocks

This produces internal fragmentation.

If only one element exists inside a new 4096-element block, almost the entire block remains unused.

Memory efficiency therefore depends on occupancy.

---

## 5. Pointer chasing

Implementation 1

```
root
 ↓
manager
 ↓
manager
 ↓
leaf array
```

Only one leaf pointer.

---

Implementation 2

```
root
 ↓
block
 ↓
block
 ↓
leaf block
```

Each additional pointer may introduce

* cache misses
* branch mispredictions
* TLB misses

This mostly affects random access.

---

## 6. TLB behavior

This is often overlooked.

Implementation 1

Large contiguous arrays occupy relatively few pages.

Sequential traversal exhibits excellent TLB locality.

---

Implementation 2

Thousands of independent blocks may occupy many unrelated pages.

Large scans therefore produce more TLB pressure.

This becomes noticeable for datasets larger than several megabytes.

---

## 7. NUMA behavior

Implementation 1

Large reallocations may migrate memory to another NUMA node.

Implementation 2

Blocks remain where they were allocated.

This may preserve locality on NUMA systems.

---

## 8. Copy cost

If a table doubles from

```
8 GB
→16 GB
```

Implementation 1 must copy

```
8 GB
```

of data.

Implementation 2 copies

```
nothing.
```

Only one additional block is allocated.

For very large databases this becomes a substantial advantage.

---

## 9. Allocation frequency

Implementation 1

Very few allocations.

Only occasional resizing.

This minimizes allocator overhead.

---

Implementation 2

Allocates every new block.

Depending on block size, this may involve thousands of allocations.

Using a dedicated arena or slab allocator largely eliminates this disadvantage.

---

## 10. Failure recovery

Implementation 1

If resizing fails,

the entire resize operation fails.

Implementation becomes more complicated because multiple column pools must remain consistent.

---

Implementation 2

Failure only affects allocation of one additional block.

Previously allocated data remain untouched.

This simplifies error handling.

---

## 11. Concurrency

Implementation 1

Resizing invalidates every column pointer.

Readers generally cannot continue concurrently.

---

Implementation 2

Existing blocks never move.

Readers may continue using old blocks while another thread allocates a new block.

This is considerably friendlier for lock-free or read-mostly workloads.

---

## 12. Stable addresses

Implementation 1

Every resize relocates data.

Pointers into columns become invalid.

Only row indices remain stable.

---

Implementation 2

Blocks never move.

Pointers inside existing blocks remain valid permanently.

This simplifies interoperability with external systems.

---

## 13. Scalability

Implementation 1 eventually reaches practical allocator limits because every column requires one very large contiguous allocation.

Implementation 2 scales naturally to arbitrarily large tables provided memory is available.

---

## 14. Deletion behavior

Implementation 1

Deletion merely marks rows unused.

No movement is necessary.

Compaction requires copying.

---

Implementation 2

Entire empty blocks could eventually be reclaimed.

This provides an opportunity for automatic memory recovery after large deletions.

---

## 15. Complexity

Implementation 1 is conceptually simpler.

Traversal logic is straightforward.

Debugging is easier.

Implementation 2 introduces

* block boundaries,
* block allocation,
* block traversal,
* additional corner cases,
* more complex iterators.

Maintenance cost is therefore somewhat higher.

---

# Overall comparison

| Aspect                    | Implementation 1  | Implementation 2                    |
| ------------------------- | ----------------- | ----------------------------------- |
| Sequential scans          | Excellent         | Good                                |
| Random access             | Excellent         | Slightly worse                      |
| Cache locality            | Excellent         | Good                                |
| TLB locality              | Excellent         | Moderate                            |
| Resize latency            | Poor              | Excellent                           |
| Memory fragmentation      | Higher (external) | Lower (external), higher (internal) |
| Internal fragmentation    | Minimal           | Moderate                            |
| Allocation count          | Low               | Higher                              |
| Stable addresses          | No                | Yes                                 |
| Huge datasets             | Moderate          | Excellent                           |
| Concurrent growth         | Difficult         | Easier                              |
| Implementation complexity | Lower             | Higher                              |

## An additional observation

One design assumption worth reconsidering is the goal of minimizing metadata at all costs. On modern 64-bit systems, a few bytes of metadata per block or per node often have negligible impact compared to the performance benefits they can provide. For example, storing a block's occupancy, parent pointer, or cached subtree size can eliminate repeated computations and improve branch prediction. When metadata is amortized over large blocks (e.g., 4096 elements), even 32–64 bytes of extra metadata amounts to less than 0.002% overhead. In many cases, optimizing for cache behavior and reducing pointer indirection yields larger performance gains than aggressively minimizing metadata alone. A useful design principle is to minimize *metadata per element*, rather than minimizing metadata in absolute terms.
---



### About minimizing metadata

People often overestimate the cost of metadata.

For example, suppose you have:

* 10 million rows
* 16 columns

If each column has one `std::vector`, then the metadata is roughly

* 24 bytes per `std::vector` (pointer, size, capacity on 64-bit)
* 16 × 24 = 384 bytes

That's essentially free compared to the actual data.

Even a manager object of a few hundred bytes is negligible.

What *is* expensive is putting metadata **per element** or **per row**.

---

## Plan 1: Manager tree + column pools

This is essentially

```
Table
 ├── manager tree
 │      ├── node
 │      ├── node
 │      └── ...
 ├── column0 vector
 ├── column1 vector
 └── column2 vector
```

Advantages:

* Very little wasted memory.
* Nice contiguous storage inside each column.
* Excellent cache locality when scanning one column.
* Columns grow independently.
* Easy SIMD/vectorization.

Disadvantages:

* Tree traversal before reaching data.
* Resizing of vectors causes occasional latency spikes.
* More allocations.
* Manager tree becomes another layer of indirection.

The resize spikes are usually acceptable if you reserve capacity geometrically (e.g. 2× growth). Amortized complexity is excellent.

---

## Plan 2: 4096-element blocks

This sounds similar to a paged array or B-tree leaf.

```
root
   |
 +--------+
 |4096 elm|
 +--------+
 |4096 elm|
 +--------+
 |4096 elm|
```

Advantages:

* No global reallocations.
* Stable indices.
* Predictable insertion.
* Fewer pointer dereferences than a deeper tree.
* Naturally NUMA-friendly.
* Much better for huge tables.

Disadvantages:

* Slightly worse sequential locality than one large vector.
* More internal fragmentation.
* More complicated indexing.

Many databases actually use something similar because avoiding huge reallocations is valuable.

---

## About pointer chasing

Pointer chasing is usually much more expensive than a few bytes of metadata.

Modern CPUs can read

```
64 bytes
```

from cache in a few cycles.

A cache miss can cost

```
100-300 cycles.
```

Reducing one pointer chase often matters more than removing dozens of bytes of metadata.

---

## Another consideration: insertion

Ask yourself:

What is the common operation?

If it's

* sequential append
* scan columns
* random row lookup

then contiguous column vectors are extremely hard to beat.

If it's

* insert in middle
* delete
* stable handles
* millions of updates

then paged storage is usually superior.

---

## Your tree size

Using

```
64 children/node
```

is interesting because

```
64 = 2^6
```

so indexing becomes

```
level0 = index >> 12
level1 = (index >> 6) & 63
leaf   = index & 63
```

Very efficient.

A 4096-page is simply

```
64 × 64
```

collapsed into one allocation.

That reduces

```
root
 -> node
   -> leaf
```

into

```
root
 -> page
```

which is indeed one fewer cache miss.

---

## One thing I'd change

You mention:

> std::vectors are allocated on heap

Not exactly.

A `std::vector` object itself is small (typically three pointers). You can place it anywhere:

```cpp
struct Table
{
    std::vector<int> col0;
    std::vector<int> col1;
};
```

Only the vector's **buffer** is allocated on the heap.

So there is rarely a reason to allocate the vector object itself with `new`.

---

## What many analytical databases do

Columnar databases often use

* fixed-size chunks/pages (1024–8192 rows),
* contiguous storage inside each chunk,
* append-only growth,
* no global reallocations.

This gives

* stable pointers,
* predictable allocation,
* good cache behavior,
* no resize spikes.

Your Plan 2 resembles this design more closely.

---

## My recommendation

If this is intended as a general-purpose in-memory column store, I would lean toward **Plan 2**, but with a small refinement:

* Store data in fixed-size pages (e.g. 2048 or 4096 elements).
* Keep one top-level array/vector of page pointers for each column.
* Avoid a separate manager tree unless you need features like sparse indexing or balancing.
* Let each page be contiguous so scans remain cache-friendly.

This gives you:

* no expensive global reallocations,
* stable indices,
* minimal metadata (one pointer per page plus page bookkeeping),
* only one extra pointer dereference to reach a page,
* good scalability to very large tables.

Finally, yes—implementing both and benchmarking them is worthwhile. Measure not just average throughput but also:

* sequential scans,
* random lookups,
* append throughput,
* insert/delete performance (if supported),
* memory overhead,
* cache miss rates (using tools like `perf` on Linux or VTune on Intel),
* latency percentiles to reveal resize spikes rather than just average timings.

Those measurements will tell you whether the extra indirection of Plan 1 or the paged layout of Plan 2 is the better fit for your workload.


---

You can formalize the two designs as follows.

---

# Plan 1 — Central Manager Tree + Column Pools

## Structure

```
                Table
                  │
        ┌─────────┴─────────┐
        │                   │
  Manager Tree Pool     Column Pools
 (internal nodes)     (leaf storage)
```

* All **internal B+ tree nodes** are stored contiguously inside one manager pool.
* Nodes do **not** contain raw pointers.
* Children are referred to by **indices** into the manager pool.
* Leaf nodes are **not** stored in the manager pool.
* Each leaf corresponds to an offset inside every column pool.
* Every column owns one contiguous storage pool (`std::vector` or equivalent).

---

## Lookup Complexity

For

* (N) rows,
* branching factor (B=64),
* (C) columns,

the tree height is

[
h=\lceil\log_{64}(N)\rceil.
]

A row lookup consists of

1. Traverse (h) internal nodes.
2. Obtain leaf offset.
3. Access all requested columns.

Hence

[
T_{\text{lookup}}
=================

O(\log_{64}N+C).
]

Since (64) is constant,

[
T=O(\log N+C).
]

---

## Memory Layout

Manager:

```
[Node][Node][Node][Node][Node]...
```

Column A:

```
[value][value][value]...
```

Column B:

```
[value][value][value]...
```

Excellent spatial locality exists inside each pool.

---

## Cache Behaviour

Random lookup:

```
Manager pool
      ↓
Leaf offset
      ↓
Column0
Column1
Column2
...
```

Upper tree levels are repeatedly reused and are expected to remain cache-resident.

Sequential range queries amortize tree traversal:

```
Tree traversal

↓

64-row batch

↓

Sequential column scan
```

---

## Advantages

* Minimal metadata.
* Excellent locality within columns.
* Excellent scan performance.
* Internal nodes occupy one contiguous pool.
* High branch factor gives shallow trees.

---

## Disadvantages

* `std::vector` reallocation causes latency spikes.
* Whole-column copies occur during growth.
* Pointers/references become invalid after resize.
* Worst-case insertion latency is unbounded.

---

# Plan 2 — Chunked (Paged) Column Pools

## Structure

Each column is divided into fixed-size pages.

```
Column

Page0
4096 elements

↓

Page1
4096 elements

↓

Page2
4096 elements
```

No manager tree is required.

Index computation becomes

```
page   = index >> 12
offset = index & 4095
```

for 4096-element pages.

---

## Lookup Complexity

Lookup requires

1. Compute page index.
2. Compute page offset.
3. Access requested columns.

Thus

[
T_{\text{lookup}}
=================

O(C).
]

No logarithmic tree traversal is needed.

---

## Memory Layout

```
Page Pointer Array

↓

Page0
4096 elements

↓

Page1
4096 elements
```

Each page remains contiguous.

---

## Cache Behaviour

Random lookup

```
Page pointer

↓

Page

↓

Column data
```

Sequential access

```
Page

↓

4096 consecutive elements
```

Hardware prefetchers work efficiently inside each page.

---

## Advantages

* No global reallocations.
* Stable element addresses.
* Predictable insertion latency.
* No resize spikes.
* Constant-time append.
* Simple index arithmetic.

---

## Disadvantages

* Slightly more metadata (page pointers).
* One additional indirection per page lookup.
* Sequential scans may be marginally less efficient than a single large contiguous array due to page boundaries.

---

# Comparison

| Property                  | Plan 1                     | Plan 2                     |
| ------------------------- | -------------------------- | -------------------------- |
| Internal structure        | B+ tree                    | Fixed-size pages           |
| Metadata                  | Very low                   | Low                        |
| Lookup                    | (O(\log_{64}N+C))          | (O(C))                     |
| Range scan                | Excellent                  | Excellent                  |
| Random lookup             | Very good                  | Very good                  |
| Worst-case append latency | High (vector reallocation) | Low (page allocation only) |
| Average append            | Amortized (O(1))           | (O(1))                     |
| Stable addresses          | No                         | Yes                        |
| Resize spikes             | Yes                        | No                         |
| Pointer chasing           | Tree levels + columns      | Page lookup + columns      |
| Memory locality           | Excellent                  | Excellent within pages     |

## Key Design Trade-off

The primary distinction is not asymptotic complexity but **latency characteristics**:

* **Plan 1** optimizes for contiguous storage and maximum scan throughput, accepting occasional high-latency resize events due to vector reallocation.
* **Plan 2** optimizes for bounded, predictable latency by eliminating global reallocations, at the cost of a small amount of additional indirection and page metadata.

For an interactive editor where responsiveness is a priority, Plan 2 provides stronger worst-case latency guarantees. For workloads dominated by long analytical scans and infrequent growth, Plan 1 may achieve slightly higher peak throughput due to fully contiguous column storage.
