9% > Now, back to the architecture problem. And no code is needed to be done. My initial instinct is to make a hierarchial table similar using the exports of table-view, but compose my own behavior-less hierarchial-table-view, that controls collapse and expand and stuff like that. Alternatively keeping Cell and Row into its own package for supplying table elements, with one package for plain table view and one package for hierarchial table view. Those two are behaviorless. Additionally, the spreadsheet-view knows nothing about its backend table target, it takes a backend component and some necessary pull-direction callbacks, for instance how cell address/position should look like, how to increment and so on, as well as keeping a geometry of it, that sometimes needs to be rerendered. I don't know whose responsibility is for the geometry bookkeeping??? But at least, make this spreadsheet-view as a generic one to be configured. At the end, I can configure different views and pack them into pre-made spreadsheet editor views for instance a plain spreadsheet view finished build, or a hierarchial one. If user want a new one, he can go and create another one for example for a triangular table or some nested table allowed, and then build his backend component and spreadsheet-view component, plumb them and then wrap them together behind another component to be publically used with a simple and intuitive interface. Is it a good idea?

> ## Verdict

Two of your three moves are right, and one contains a contradiction that will reintroduce the exact problem you're escaping. The
address-algebra idea is the best thing in the plan — better than what I proposed last time, because it generalizes to triangular and
nested tables, which a row model alone does not.

## The contradiction: "behaviourless hierarchical view that controls collapse and expand"

Collapse and expand is behaviour, and by your own definition (TableView draws; decisions leave through callbacks) it cannot live in a
view. If expansion state sits inside HierarchicalTableView, then:

- the host can't drive it — no "expand all", no persisting expansion per window, no restoring it from a URL;
- the selection and edit layers can't see it, so they can't react when a collapse hides the edited node — that's your
key={grid-reset-...} hack coming back;
- nothing outside can observe the splice, so nothing can rebase a selection or invalidate geometry incrementally.

Draw the line inside hierarchy itself: rendering a twisty and an indent is drawing; holding which nodes are open, and deciding what a
twisty click means, is behaviour. So the view asks is this row expanded, at what depth and reports toggle requested at this row, while
an expansion store — same subscribe/getSnapshot shape as your SelectionController — owns the answer. That's the third store
alongside selection and editing, and it's what makes the view genuinely behaviourless rather than nominally so.

This also matters because expansion must never enter the undo stack. Keeping it in a view-owned store, next to selection, is what
guarantees that; a collapse should be as undoable as a scroll, which is to say not at all.

## Do you need two view packages?

Probably not, and I'd resist it. Plain and hierarchical differ in only two things: what the visible row sequence contains, and
whether a cell draws a twisty. Neither is a markup difference. Two parallel view packages sharing Cell/Row will drift, and you'll fix
the same layout bug twice.

What does justify a second view is a genuine divergence in markup capability. Triangular and ragged tables need rows that report their
own cell count plus row/col spans — that's a capability of one view, not a new view. Nested tables (a cell containing a sub-table)
are the real fork, and they're best handled by composition anyway: the cell renders another table view with its own stores.

So split by markup capability, not by domain. One view with ragged-row and span support plus a per-row depth/kind hook covers plain,
hierarchical, and triangular. Extract a second view only when you hit nesting.

One honesty point: a hierarchical view still has to emit <tr>s in a flat sequence, because HTML tables are flat. You do not escape
flattening — you relocate it from host render code into a model that has identity and can express deltas. That relocation is the
whole win, so if the hierarchical view recomputes flattening during render, you've moved the bug rather than fixed it. Your plan and
the row model are the same plan; the model is what the hierarchical row sequence should be.

## The address algebra — the strong idea, with sharp edges

"How a cell address looks, how to increment" is exactly right, and it's what makes spreadsheet-view genuinely target-agnostic. Every
behaviour you have or want — arrow-key movement, shift-extend, range enumeration, fill, copy — needs only: identity/keying, document
order, stepping in a direction, and enumerating the span between two addresses. Give it those and row+1 never appears in behaviour
code, which is what lets a tree or a triangle plug in.

Two edges to plan for:

Ranges stop being rectangles. In a tree, "from X to Y" is the visible span between them, like shift-click in a file explorer — one-
dimensional. In a triangular table, a rectangle contains cells that don't exist. So enumerating a range must be the address space's
job, and no behaviour may assume rectangularity. Your bounds() helper is exactly the assumption to remove.

The clipboard is rectangular and won't negotiate. Copying a hierarchical selection has to project onto a rectangle with padding, and
pasting into one has to decide what a shifted row means. There's no clean answer; just decide the projection deliberately rather than
discovering it.

And design the algebra against two real implementations at once — flat and tree. An interface designed against one implementation
will be wrong, and triangular is then the test of whether it generalized, not the thing you designed for.

## Geometry: whose job?

You asked, so: geometry belongs to the table backend, published as an interface, consumed by the overlays. Nobody else can own it.

The reason is in your own CSS comment: column widths come from the browser under table-layout: auto, so geometry can only be
measured, and only the thing that owns the markup knows what to measure — where the spans are, where the sticky gutter is, what the
nesting does. Equally, only it knows when the measurement went stale. Your SelectionRangeLayer already proves both halves: it does
the querySelector on data-row/data-col and runs the ResizeObserver. That's the backend's knowledge currently living in an overlay,
which is why the overlay can't survive a change of table shape.

The interface needs both directions — the rect of an address, the rect of a range, and the address at a point. Hit-testing a point is
what a drag past the last row needs for autoscroll, and it's the inverse of the same knowledge, so it must come from the same owner.
Add a subscription for invalidation and the overlays depend on four methods instead of on your DOM.

Now the decision that this exposes, and it's the one I'd think hardest about: virtualization forces geometry to be computed, not
measured. To render only the visible window you must know row offsets before rendering the rows — which you cannot do if a row's
height depends on content that hasn't rendered. Intrinsic sizing and virtualization are in direct tension, and your multiline cells
make variable heights real, not hypothetical.

Three ways out. Fixed row heights and explicit column widths make geometry O(1) arithmetic from the model, kill the invalidation
storms, and are what Excel and every fast grid do — at the cost of the intrinsic sizing you deliberately built. Or measure-then-
correct: estimate, render, measure, patch a prefix-sum index, and accept visible scrollbar jitter. Or keep measuring and drop
virtualization, which is fine up to a few thousand rows and is a legitimate choice you could make explicitly rather than by default.

I'd pick fixed heights for the row axis and keep intrinsic widths for the column axis. Widths are measured once per data change and
shared by all rows; heights are per-row and are what virtualization actually needs. That split gets you both properties where each is
cheap.

## Component-as-prop: the weak link

"Spreadsheet-view takes a backend component" is the right dependency direction expressed the wrong way. If the shell renders the
injected component, it has to know that component's prop shape to pass anything through — so you keep the coupling and lose the type
checking, and you get a debugging experience where the props flow through a variable.

Invert it once more. Make the behaviour a hook plus a set of stores, and let the pack do the wiring: the hook takes the address space
and the stores and hands back the callbacks and geometry hookup, and the pack spreads them onto whichever table layer it chose, with
the overlay layers as siblings. Composition by children and hooks rather than by a component slot. Each pack then reads as a short,
explicit assembly — you can see the whole wiring on one screen — and a user building a triangular editor writes their own 30-line
pack rather than satisfying a generic prop contract.

The corollary: your TableLayoutLayer-as-pass-through was the right instinct, but the layer that survives is the one that adds
virtualization and dirty-mark memoization. That's where those belong, since both need the model's deltas and the geometry index.

## Layering, and dependency direction

table-elements   Cell, Row, ColumnHeader (+ their css)
      ▲
table-view       draws a row sequence; ragged rows, spans, depth/kind hook
                 publishes Geometry
      ▲
models/stores    RowModel (structure+expansion), Selection, Editing
address space    identity, order, step, enumerate-range
      ▲
spreadsheet      layers + hooks: virtualization, dirty marks, selection, editing
      ▲
packs            PlainSpreadsheet, OutlineSpreadsheet, ...  (thin, public API)


Keep these as folders, not published packages, until something outside this repo consumes one. Folder boundaries cost nothing and are
easy to move; package boundaries freeze an API you haven't validated yet.

Watch two things in that diagram. CSS follows the same layering, so the shared class names (.cell, .row) become a real contract
between table-elements and every view — and .table-layout* in today's TableView.css is layout-contract CSS that a second view would
also need, so it wants to be identified as such rather than named after one component. And nothing above table-view may import from
it except through the geometry interface, or the overlays quietly re-acquire knowledge of the markup.

## What it costs

You're adding two indirections — the address algebra and the geometry interface — and both are the kind that pay off only at the
second implementation. Against one table shape they're pure overhead, which is why I'd build flat and outline simultaneously and
refuse to design for triangular until those two work. The prefix-sum height index is the genuinely fiddly code. And exactly one place
may translate addresses to positions; if that leaks into two, you have today's stale-index bugs back with more layers to hide in.

The compatibility path is the same as before: keep the current SpreadsheetView API as one of the packs, constructing a flat address
space and a trivial model internally, so your 440 tests and both demos keep passing while the outline pack grows beside it.

 ▸ Credits: 2.32 • Time: 1m 50s

9% > Can you sort these findings out and conclude how the architecture for tables should be built

> ## The one-sentence conclusion

Build three separated concerns — markup that only draws, stores that own structure and view state, behaviour assembled by hooks — joined
by two interfaces you don't have yet: an address space (what a cell address is and how to move through it) and a geometry interface (
where an address is on screen). Everything else follows, and the hierarchical-wrapper component disappears from the plan.

## Layering

table-elements     Cell, Row, ColumnHeader (+ css)          ← markup vocabulary
      ▲
table-view         draws a row sequence; ragged rows, spans,
                   per-row depth/kind; PUBLISHES Geometry
      ▲
models             RowModel (structure) · Expansion · Selection · Editing
                   AddressSpace (identity, order, step, enumerate)
      ▲
spreadsheet        layers + hooks: virtualization, dirty marks,
                   selection, editing — all in address terms
      ▲
packs              PlainSpreadsheet · OutlineSpreadsheet · …  ← public API


Folders, not published packages, until something outside the repo consumes one. Dependency rule: nothing above table-view may know
the markup — the only channel is the geometry interface. Break that and the overlays silently re-acquire DOM knowledge, which is the
state they're in today.

## The nine decisions

1. One table view, not two. Plain and hierarchical differ in what the row sequence contains and whether a cell draws a twisty.
Neither is a markup difference. Split views by markup capability (ragged rows, spans) not by domain, or you'll fix the same layout bug
twice.

2. Expansion is behaviour, so it lives in a store. Your instinct to put collapse/expand in a "behaviourless" hierarchical view is the
one contradiction in the plan. The line runs inside hierarchy: drawing a twisty and an indent is drawing; holding which nodes are
open, and deciding what a click means, is behaviour. The view asks depth, expanded? and reports toggle requested; an
ExpansionController with your subscribe/getSnapshot shape owns the answer. This is what lets the host do "expand all", lets the edit
layer notice its row vanished, and — decisively — keeps a collapse out of the undo stack.

3. RowModel is the missing middle layer. Flattening doesn't disappear (HTML <tr>s are flat); it relocates from host render code into
an object with identity that can publish deltas — spliced(start, removed, inserted) / changed(keys) / reset. That relocation is the
entire win. A toggle becomes a splice into its own index, not a rebuild, and the business tree is untouched — which answers "why am I
modifying business data when I didn't edit anything?"

4. Addresses, not indices, in every callback and every range. Behaviour needs only four things from an address space: identity/
keying, document order, stepping in a direction, enumerating the span between two addresses. Give it those and row + 1 never appears
in behaviour code — which is what makes a tree or a triangle pluggable. Consequence: ranges stop being rectangles (a tree range is a
visible span, like shift-click in a file explorer), so bounds() is precisely the assumption to delete.

5. Geometry belongs to table-view, published as an interface. Nobody else can own it: widths come from the browser under
table-layout: auto, so geometry is measured, and only the markup owner knows what to measure and when it went stale. Needs both
directions — rect of an address, rect of a range, and address at a point (a drag past the last row needs hit-testing for autoscroll) —
plus an invalidation subscription. Your empty useTableGeometry.tsx is in the wrong folder: it belongs one layer down.

6. Fixed row heights, intrinsic column widths. Virtualization needs offsets before rendering; intrinsic sizing only knows them after.
That tension is real, not hypothetical, because your multiline cells make heights variable. Resolve it per axis: widths are measured
once per data change and shared by all rows (cheap, keeps what you built); heights come from the model as arithmetic (which is what
virtualization actually needs).

7. Compose with hooks and stores, not a component-as-prop. "Spreadsheet-view takes a backend component" is the right dependency
direction, wrongly expressed — if the shell renders the injected component it must know its prop shape, so you keep the coupling and
lose type checking. Instead the behaviour is a hook over the address space and stores, returning callbacks plus the geometry hookup,
and the pack spreads them onto whichever table layer it chose with the overlays as siblings. Each pack is then a short, readable
assembly.

8. Nesting is the only genuine fork, and it's composition. A cell renders another table view with its own stores. Price, stated
plainly: no selection rectangle and no column alignment across the boundary — which is exactly why an outline ledger must not be built
this way.

9. Keep TableLayoutLayer, give it a job. Pass-through was the right instinct; what survives is the layer that adds virtualization and
dirty-mark memoization, because both need the model's deltas and the geometry index. Memoized rows keyed by stable rowKey are what
make "dirty mark rendering" in your README implementable at all — it was blocked on identity, not on cleverness.

## How each existing file lands

- table-view/{Cell,Row,ColumnHeader} — unchanged; they're already right.
- table-view/TableView — gains per-row depth/kind, ragged rows and spans; publishes geometry. Its .table-layout* CSS is a layout
contract shared by any future view, so name it as such rather than after one component.
- spreadsheet-view/SelectionRangeLayer — loses the querySelector on data-row/data-col and the ResizeObserver; consumes geometry
instead. This is the single change that most improves the architecture, because that code is table-view's knowledge living in an
overlay.
- SelectionController — corners anchored to keys, resolved to positions at render; range enumeration delegated to the address space.
- SpreadsheetView — becomes the PlainSpreadsheet pack, constructing a flat address space and trivial model internally, so its current
API, your 440 passing tests and both demos keep working.
- HierarchicalLedgerDemo — rewritten on the outline pack; the ordinal counter, editingPath guard and key={grid-reset-…} remount all
delete themselves.
- HierarchicalSpreadsheetView — never built.
- Empty EditBox/EditBoxLayer/useTableGeometry — the last becomes table-view's geometry; the first two stay Layer 3, now addressing
cells by key.

## Build order

Design the address space against flat and outline simultaneously — an interface validated against one implementation will be wrong,
and triangular is then the test of whether it generalized, not the thing you design for.

1. AddressSpace + flat implementation behind today's API. No behaviour change; tests stay green.
2. Geometry interface; move measurement down into table-view, point the overlay at it.
3. RowModel (flat) + delta protocol. Selection rebasing moves off the host — the model knows the splice, so it hands the delta to the
selection store, and the README's manual "increment all (row,col) on insert" bookkeeping goes away.
4. ExpansionController + depth/kind + tree RowModel → the outline pack. Hierarchy works here.
5. Dirty-mark memoization, then virtualization (needs decision 6 and a prefix-sum index).
6. Ragged rows and spans → triangular. Not before.

If you want hierarchy working this week, mount all rows and toggle display: none — honest, O(1), incompatible with virtualization,
and not the architecture.

## Invariants to hold, and what it costs

Four rules worth testing, because each one is a bug you've already had: expansion never enters the undo stack; exactly one place
translates addresses to positions; nothing above table-view touches the DOM; no behaviour assumes rectangularity.

The costs are honest. Two indirections that only pay off at the second implementation, so they look like pure overhead until step 4.
The prefix-sum height index is the genuinely fiddly code. The clipboard stays rectangular and won't negotiate — copying a tree
selection needs a padding projection you should choose deliberately rather than discover. And the shared class names (.cell, .row)
become a real cross-layer contract once a second view exists.

The compensation: RowModel, AddressSpace and the stores are plain objects with no DOM, so the hard logic becomes unit tests instead
of the jsdom suites you're currently relying on.