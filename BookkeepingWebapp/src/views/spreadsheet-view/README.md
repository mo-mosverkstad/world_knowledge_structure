# SpreadsheetView

A **data-driven** spreadsheet / grid component, built with the same architecture
as the `tab-bar` module. It knows nothing about the shape of your business data:
you pass the data through a single port and tell the component how to read cells
and forward mutations via callbacks (classic dependency inversion). The
component owns only what is intrinsic to *being a grid* — presenting a
rectangular region of cells, remembering the selected cell, keyboard
navigation, and an inline editor.

## Quick start

```tsx
import { SpreadsheetView, type CellDescriptor } from "./views/spreadsheet-view";

interface Ledger {
    rows: { date: string; description: string; amount: number }[];
}

<SpreadsheetView<Ledger>
    data={ledger}
    getRowCount={(d) => d.rows.length}
    getColumnCount={() => 3}
    getColumnHeader={(_, col) => ["Date", "Description", "Amount"][col]}
    getCell={(d, row, col): CellDescriptor => {
        const t = d.rows[row];
        // A switch, not an array literal indexed by `col`: the array version
        // allocates three descriptors on every cell read and throws two away.
        switch (col) {
            case 0:
                return { value: t.date };
            case 1:
                return { value: t.description };
            default:
                return { value: t.amount.toFixed(2), align: "right" };
        }
    }}
    onCellEdit={(row, col, value) => applyEdit(row, col, value)}
    editable
/>;
```

See `src/main.tsx` (`DataDrivenSpreadsheetDemo`) for a full working example.

## Design principles

- **Data port + callbacks, no coupling.** The business data is passed through
  `data` and is opaque. Reads go through `getCell` / count callbacks; writes go
  through `onCellEdit`. The grid never touches your domain objects.
- **Random access, not iteration.** Unlike the tab bar (which uses a single-pass
  iterator because it renders *all* tabs), a grid renders a rectangular *region*.
  `getCell(data, row, col)` is O(1) random access — the primitive that pairs
  with virtualization: a future viewport asks only for the visible
  `[firstRow..lastRow] × [firstCol..lastCol]` without changing this API.
- **Native `<table>`, not a div surrogate.** The UI layer renders real
  `<table>` / `<colgroup>` / `<thead>` / `<tr>` / `<th>` / `<td>`. The browser
  already implements two-dimensional tabular layout; reimplementing it with
  flex `div`s means reimplementing column-scoped widths, intrinsic sizing,
  border collapsing, cell spanning and header semantics by hand. See
  [Why a native table](#why-a-native-table).
- **Coordinator vs. UI.** `SpreadsheetView` coordinates *behavior* and renders no
  raw HTML. Markup lives in `Grid` / `Row` / `Cell` / `ColumnHeader`, which also
  translate raw DOM events into semantic ones and host the inline editor. This is
  what made the move to a native table a UI-layer-only change.
- **Logical vs. ephemeral state.** *Logical* selection is meant to be
  externalizable via the `activeCell` / `onSelectionChange` seam, so it can live
  in your app's central state and participate in undo/redo. Note that the seam is
  currently READ-ONLY and therefore incomplete — see
  [Controlled selection is read-only](#controlled-selection-is-read-only-unlike-the-tab-bar).
  *Ephemeral* editing state (which cell is being edited, the draft text) stays
  inside the renderer.
- **Focused hooks.** Each concern (selection, editing, focus restoration) is its
  own hook, so the coordinator holds no primitive state.

## Why a native table

The UI layer emits real table elements:

```
  <div class="grid">                 ← SCROLL VIEWPORT (clips, scrolls)
    <table role="grid">              ← THE TABLE (sizes to content)
      <colgroup>                     ← width declared once per COLUMN
        <col class="grid__col-gutter">
        <col class="grid__col">  × n
      <thead>
        <tr>  <th class="grid__corner" aria-hidden>  <th scope="col"> × n
      <tbody>
        <tr class="row">  <th scope="row">  <td role="gridcell"> × n
```

What the platform gives us that a stack of flex `div`s does not:

| Capability | Native | With `div`s |
| ---------- | ------ | ----------- |
| Width is a **column** property | `<col style="width">` sizes the whole column | every cell restates its own width; alignment is a convention that must be maintained |
| **Intrinsic sizing** | `table-layout: auto` fits each column to its widest cell — native "resize to fit" | measure every cell in JS and write widths back |
| **Collapsed borders** | `border-collapse` makes neighbours share one 1px rule | each cell draws its own → doubled seams to cancel by hand |
| **Spanning** (merged cells) | `rowspan` / `colspan` | no equivalent for flex children |
| **Header semantics** | `<th scope="col">` *is* a column header | `role="columnheader"` on a `div` — a claim, not a property |
| **Vertical centring** | `vertical-align: middle` | another flex context per cell |

### Two elements, not one

`.grid` (a `div`) and `.grid__table` are deliberately separate. A table sizes
itself to its content — which is what makes column auto-fit work — and one element
cannot both grow to fit its content and clip it to a fixed box. Putting `overflow`
on the wrapper keeps both properties.

That split is also what makes frozen headers free: `position: sticky` resolves
against the nearest scrolling ancestor, so `top: 0` on a `<th>` and `left: 0` on
the row gutter need no scroll listener and no JavaScript. Stacking order matters
and is assigned deliberately: row gutter `1` < header row `2` < corner `3`, since
the corner is frozen in both directions and overlaps both.

### Roles are still explicit

A `<table>` maps to ARIA `role="table"` and a `<td>` to `role="cell"` — verified
in jsdom, not assumed. Those are the *static document* roles. An interactive,
focusable, navigable widget is `grid` / `gridcell`, so those roles are set
explicitly on top of the native elements. The element buys layout and header
semantics; the role still has to state the interaction contract.

The corner cell above the row gutter labels nothing, so it is `aria-hidden` with
no `scope` rather than being announced as an empty header.

### What this refactor did *not* change

Behaviour, and the public API. The 30 behaviour tests were written first against
the old `div` implementation, deliberately in terms of ARIA roles, rendered text
and user actions — never `div` vs `table` — and all 30 passed unchanged against
the new markup. That is the payoff of keeping `Grid` / `Row` / `Cell` as an
encapsulated UI layer: the coordinator names only *what* appears, never *which
element* it is, so swapping the entire DOM representation touched no behavioural
code.

One structural fix came along with it: the coordinator used to build the header
strip from inline `<div className="grid__col-header">`, the single place it broke
its own "renders no raw HTML" rule. That markup now lives in `ColumnHeader.tsx`.

## File layout

| File                  | Role                                                                | Exported? |
| --------------------- | ------------------------------------------------------------------- | --------- |
| `index.tsx`           | Front door. Re-exports the public API only.                         | —         |
| `SpreadsheetView.tsx` | The behavior coordinator; composes the pieces below.                | Yes public |
| `types.ts`            | Public data contract: props, `CellDescriptor`, `CellAddress`.       | Yes public |
| `Grid.tsx` / `.css`   | Internal UI: scroll viewport + `<table>`, `<colgroup>`, `<thead>`.  | No private |
| `ColumnHeader.tsx` / `.css` | Internal UI: one `<th scope="col">`, plus the gutter corner.  | No private |
| `Row.tsx` / `.css`    | Internal UI: one `<tr>` + optional `<th scope="row">` gutter.       | No private |
| `Cell.tsx` / `.css`   | Internal UI: one `<td>`; raw→semantic events; inline editor.        | No private |
| `useSelection.ts`     | Internal hook: active-cell state, click/arrow move, clamp, notify.  | No private |
| `useEditing.ts`       | Internal hook: ephemeral editing cell + draft.                      | No private |
| `useReturnFocus.ts`   | Internal hook: give focus back to the grid when the editor closes.  | No private |
| `style.css`           | Styles for the outer key-handling container only.                   | —         |

Only `SpreadsheetView` and the types in `types.ts` are exported from `index.tsx`.

## Public API

### `SpreadsheetView<TData>` props

| Prop                | Type                                                | Purpose                                             |
| ------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `data`              | `TData`                                              | The data port — your arbitrary business structure.  |
| `getRowCount`       | `(data) => number`                                   | Number of rows.                                     |
| `getColumnCount`    | `(data) => number`                                   | Number of columns.                                  |
| `getCell`           | `(data, row, col) => CellDescriptor`                 | Random-access cell projection (O(1) expected).      |
| `getColumnHeader`   | `(data, col) => ReactNode`                           | Optional column header; enables the header strip.   |
| `onCellEdit`        | `(row, col, value, data) => void`                    | Mutate callback: apply a committed edit.            |
| `onCellClick`       | `(row, col, data) => void`                           | Behavior hook: what a click means.                  |
| `onSelectionChange` | `(cell \| null, data) => void`                       | Fires when the active cell changes.                 |
| `editable`          | `boolean`                                            | Enable editing (per-cell override via descriptor).  |
| `multiline`         | `boolean`                                            | Allow line breaks (per-cell override via descriptor).|
| `activeCell`        | `CellAddress \| null`                                | Controlled selection. READ-ONLY today — see below.  |
| `defaultActiveCell` | `CellAddress`                                        | Initial selection (uncontrolled).                   |
| `className`         | `string`                                             | Extra class on the `<table>` element.               |

### `CellDescriptor`

```ts
interface CellDescriptor {
    value: ReactNode;                        // rendered content
    editable?: boolean;                      // per-cell override of `editable`
    multiline?: boolean;                     // per-cell override of `multiline`
    align?: "left" | "center" | "right";     // alignment hint
    className?: string;                       // domain-specific styling
    tooltip?: string;                         // native tooltip
}
```

## Interaction

- **Select:** click a cell, or use arrow keys to move the selection. Arrow keys
  are handled on the outer container, which carries `tabIndex={0}` so it can
  receive them. From an empty selection the first arrow key selects `(0,0)`
  before applying the delta, so `ArrowDown` lands on row 1 and `ArrowRight` on
  column 1.
- **Edit:** double-click, or press Enter / F2 on the active cell. Enter commits,
  Escape cancels, and blurring commits — but only when focus moves to another
  element, not when it leaves the page. Arrow keys are inert while editing (the editor
  stops their propagation), so they move the caret, not the selection. When the
  editor closes, focus returns to the grid so navigation keeps working — see
  [Focus returns to the grid](#focus-returns-to-the-grid-when-the-editor-closes).
- **Multiline:** with `multiline`, `Alt+Enter` inserts a line break at the caret
  while `Enter` still commits — see [Multiline cells](#multiline-cells).

### Multiline cells

`multiline` (view-wide, or per cell via the descriptor) lets a value contain
line breaks. Key bindings while editing:

```
   Enter       commit
   Escape      abandon
   Alt+Enter   insert a line break at the caret   (multiline cells only)
```

Enter keeps meaning *commit* rather than *new line*, matching Excel: the common
action gets the unmodified key and the rarer one takes the modifier. In a
single-line cell `Alt+Enter` is inert — deliberately not falling through to
commit, so a stray newline can never reach a value the caller parses as a
number.

#### Why the element has to change

An `<input>` *silently discards* newlines. Measured:

```
   input.value    = "a\nb"   ->  "ab"     <- the break is gone
   textarea.value = "a\nb"   ->  "a\nb"
```

So no amount of key handling could make an `<input>` hold a line break; only
the element choice can. `multiline` therefore switches the editor to a
`<textarea>`. That assertion is itself a test, so if `<input>` ever gains
newline support the decision gets revisited rather than silently outliving its
reason.

#### Why `setRangeText`, not string splicing

The obvious implementation — `draft.slice(0, caret) + "\n" + draft.slice(caret)`
— loses the caret. The browser has already applied the value and placed the
caret at the end, so inserting a break mid-word jumps the caret to the end of
the text. Measured on `"hello| world"` with the caret at 5:

```
   hand splice     value "hello\n world"   caret 12   <- unusable
   setRangeText    value "hello\n world"   caret 6
```

`setRangeText` performs the edit and moves the caret in one step, and it
replaces the current *selection* when there is one — which is what a user
pressing Alt+Enter over selected text expects. The resulting DOM value is then
pushed into React state unchanged, so React has nothing to rewrite and the
caret survives the re-render. The DOM stays the single source of truth for both
text and caret position.

#### Two bugs this feature had first

Both were reported from a real browser while the jsdom tests were green, which
is the useful lesson: the tests sent only `keydown`, and neither bug lives in a
keydown.

**1. Alt itself committed the edit.** `onBlur` was wired straight to commit. On
Windows and Linux, pressing Alt hands focus to the browser menu bar, which blurs
the editor — so the cell committed the instant Alt went down and a line break
could never be typed. The fix is to distinguish *why* focus left:

```
   blur, relatedTarget = <some element>   the user moved focus  -> commit
   blur, relatedTarget = null             focus left the page   -> ignore
```

Only the first is an edit decision. Ignoring the second does not trap the user:
clicking another cell, Enter and Escape all still work afterwards, and each of
those is a test.

**2. The first Alt+Enter destroyed the cell value.** The editor opens with its
whole value SELECTED, so that typing replaces it — correct grid behaviour. But
`setRangeText` *replaces the selection*, so inserting a break over a full
selection wiped the value and left a bare newline. Silent data loss, in the
common case.

The insertion now collapses the selection to its end instead of overwriting it,
which is also the safer reading of the gesture: Alt+Enter asks to ADD a line and
never to delete text. Deleting has its own keys.

#### The display half

Storing a newline is not enough to show one. A cell is `white-space: nowrap` by
default, which renders `"a\nb"` as `"a b"` — the value would be right and the
display wrong. Multiline cells get a `cell--multiline` class carrying
`white-space: pre-wrap`, which keeps explicit breaks *and* still wraps long
lines. Plain `pre` would keep the breaks but refuse to wrap, letting one long
line widen the column under `table-layout: auto`.

Such cells also switch to `vertical-align: top` and `height: auto`, so a
wrapped cell grows and the row height follows it — native table behaviour, no
measurement code. Note jsdom applies no stylesheets, so the tests can only
verify that the class hook is present; the rendered result is unverified.

### Focus returns to the grid when the editor closes

Keyboard navigation lives on the outer container, so it only works while focus
is inside the grid. The inline editor takes focus when it opens, and when it
unmounts the browser has nowhere to put focus and drops it on `<body>` — outside
the container. Measured before the fix:

```
   F2            focus: INPUT.cell__editor   selection: a2
   Enter commit  focus: BODY                 selection: a2   <- focus lost
   ArrowDown     focus: BODY                 selection: a2   <- nothing moves

   (dispatching the same ArrowDown directly at the container DID move it,
    which is how we know the navigation code was never the problem)
```

So editing one cell disabled arrow-key navigation for the rest of the session.
`useReturnFocus` fixes it by returning focus to the container on the
`isEditing: true -> false` transition.

Two properties are worth stating, because they are what separates focus
restoration from focus *stealing*:

- **Observed, not called.** The hook watches the editing flag; no commit path
  invokes it. That is why Enter, Escape and blur are all covered by the same
  three lines, and why `useEditing` stays a pure state container that knows
  nothing about the DOM — the same decoupling as the tab bar's
  `useRevealActiveTab`.
- **Only when focus was genuinely lost.** If the user committed by clicking
  something else, that something else is now focused and is left alone. Focus is
  restored only when `document.activeElement` is `<body>`, the root, or nothing.

It is a *layout* effect, so focus lands in the same frame the editor disappears
rather than after a paint in which the document has no focused element.

Note this is a separate problem from cells not being focusable (see the scope
notes): focus is restored to the *container*, which is where the key handler is.
Per-cell focus with a roving tabindex would be a further change.

### Controlled selection is read-only, unlike the tab bar

Supplying `activeCell` makes the component render that cell and stop tracking
selection internally — but there is **no write half**. `useSelection.select()`
and `.move()` both early-return when controlled, and `onSelectionChange` fires
only when the *resolved* value changes, i.e. after the host has already changed
it. So in controlled mode a click or an arrow key is silently dropped:

```
   uncontrolled          click → internal state moves → onSelectionChange
   controlled            click → (nothing)            → onCellClick only
```

Measured with `activeCell={{row:0,col:0}}`: clicking cell (1,1) fires
`onCellClick(1,1)` and nothing else; the selection stays on (0,0). A host that
wants controlled selection must therefore drive it from `onCellClick`, which is
documented as a free-form behavior hook rather than a selection request.

This is the same defect the tab bar had before `onActiveTabSelect` was added: a
read prop with no matching write prop is not a controlled component, it is a
component whose interaction is disabled. The fix would mirror the tab bar — an
`onSelectionSelect(cell, data, reason)` request that fires in both modes, with a
single internal writer resolving ownership once. Not implemented yet, so it is
recorded here rather than implied to work.

## Tests

`tests/views/spreadsheet.test.tsx` — 70 tests, in four groups:

- **30 behaviour tests**, written only in terms of ARIA roles, rendered text and
  user actions — never `div` vs `table`. These were written *before* the move to
  a native table and all 30 passed unchanged afterwards, which is what actually
  demonstrates that the UI layer is encapsulated.
- **10 structure tests**, which pin the native markup itself. The behaviour
  tests would happily keep passing if the grid regressed to a stack of `div`s,
  so the requirement needs its own tests.
- **6 focus tests**, which assert on `document.activeElement` and then dispatch
  keys at whatever is focused rather than at the container. Dispatching at the
  container passes even when focus has been lost, which is exactly how the
  post-edit navigation bug slipped past the first suite.
- **24 multiline tests**, covering the key bindings, caret placement, the
  per-cell override in both directions, and the interaction with focus
  restoration. One of them asserts the platform fact the design rests on — that
  `<input>` drops newlines — so the element choice cannot outlive its reason.
  Several send the `blur` that follows a keypress in a real browser, not just
  the keypress: both shipped multiline bugs were invisible to keydown-only
  tests.

Each group was confirmed to *bite* by sabotaging the implementation:

```
  sabotage                                        tests failed
  ------------------------------------------------------------
  revert Cell to a <div>                          2
  remove <colgroup>                               2
  drop role="grid"                                9  (incl. all navigation,
                                                      which locates by role)
  remove focus restoration                        4
  drop the focusWasLost guard (steal focus)       1
  weaken the editing-transition check            1  (grabs focus on mount)
  always use <input> (never <textarea>)           8
  hand-splice instead of setRangeText            1  (caret lands at the end)
  let Alt+Enter fall through to commit           4
  drop the single-line guard on insertion        1
  remove the cell--multiline class               1
  let a null-relatedTarget blur commit           3  (bug 1 below)
  replace the selection instead of collapsing    2  (bug 2 below)
```

One of those needed a second attempt. "Alt+Enter is inert in a single-line cell"
passed even with the guard removed, because an `<input>` strips the newline by
itself — the DOM looks identical either way, so the test could not distinguish
guarded from unguarded. It now spies on `setRangeText` to assert that no
insertion is even attempted, which does bite.

Two traps worth remembering when extending these:

- **Use `fireEvent`, not hand-built DOM events.** A raw
  `input.dispatchEvent(new Event("input"))` does not drive React's synthetic
  `onChange`, so the draft never updates and a commit test silently asserts the
  *old* value. That produced a failure that looked like a component bug and was
  not one.
- **jsdom has no layout engine.** Nothing about the visual result is verified:
  sticky-header stacking, border collapsing and intrinsic column sizing are
  reasoned about, not observed. `npm run dev` has not been run against this
  component.

## Scope notes (intentionally NOT built yet)

Following the design discussion, this is a straightforward first implementation.
It deliberately does **not** yet include virtualization, a layout engine
(variable row heights / column widths via prefix sums), merged cells, range
selection, clipboard, or a tree/hierarchical row model. The public API —
especially the random-access `getCell` contract — is shaped so those subsystems
(a `viewport/` + `layout/` engine feeding the same `Grid`) can be added later
without breaking consumers. Extract those modules when real complexity demands
it, not before.

Moving to a native table changed the status of two of these:

- **Frozen header and gutter now exist**, via `position: sticky` against the
  `.grid` scroll viewport — no JavaScript. Frozen *panes* (an arbitrary split
  point rather than just row 0 / column 0) are still not built.
- **Merged cells became reachable** rather than needing a parallel layout
  system: `rowspan` / `colspan` are native attributes on the `<td>` that `Cell`
  already renders. The work left is contract design — how a `CellDescriptor`
  states a span and how the coordinator skips the cells it covers — not layout
  machinery.

One caveat pointing the other way: `table-layout: auto` measures every cell to
size each column, which is O(cells) and is exactly the work virtualization
exists to avoid. If virtualization is added, that must become
`table-layout: fixed` with widths supplied by the layout engine. This is noted
in `Grid.css` beside the declaration.

Known gaps that are defects rather than unbuilt features:

- **Controlled selection has no write half** (see
  [above](#controlled-selection-is-read-only-unlike-the-tab-bar)) — clicks and
  arrow keys are dropped when `activeCell` is supplied.
- **Cells are not focusable in practice.** Each `<td>` carries
  `tabIndex={active ? 0 : -1}`, the roving-tabindex pattern, but nothing calls
  `.focus()` on a cell, so keyboard focus lives on the outer container. The
  `tabIndex` is currently decoration. This is *not* the post-edit navigation bug
  — that one is fixed by returning focus to the container. Moving focus to the
  active cell itself would be a further change, and would let
  `useReturnFocus` target the cell rather than the container.
- **No `aria-rowcount` / `aria-colcount` / `aria-rowindex` / `aria-colindex`.**
  Harmless while the whole grid is rendered; required once virtualization means
  the DOM holds only a window of the data.
