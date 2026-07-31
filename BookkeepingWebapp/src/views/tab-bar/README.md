# TabBar

A **data-driven** tab bar component. It knows nothing about the shape of your
business data: you pass the data in and tell the component how to read and mutate
it via callbacks. The component owns only what is intrinsic to *being a tab bar* —
presenting tabs and offering optional close / reorder affordances.

Which tab is **active** is deliberately *not* owned by the component when you
don't want it to be. It is a standard **controlled component**, the same pattern
as `<input value onChange>`, so the active tab can live in your state and be
changed by anything in your app.

## Quick start

```tsx
import { TabBar, type TabDescriptor } from "./views/tab-bar";

// Your own, arbitrary business data structure.
interface MyState {
    docs: { key: string; label: string }[];
    activeKey: string | null;
}

<TabBar<MyState>
    data={state}
    // Traverse your structure once, yielding each tab.
    forEachTab={(data, visit) =>
        data.docs.forEach((d, i) => visit({ id: d.key, title: d.label }, i))
    }
    // Behavior is defined by you, not the component.
    onTabClick={(id) => open(id)}
    onTabClose={(id) => removeDoc(id)}
    onTabReorder={(from, to) => moveDoc(from, to)}
    // The active tab lives in YOUR state, so anything can change it.
    activeTabId={state.activeKey}
    onActiveTabSelect={(id) => setActiveKey(id)}
    closable
    reorderable
/>;
```

See `src/main.tsx` (`DataDrivenTabBarDemo`) for a full working example: 17 tabs so
the strip overflows on a normal display, buttons that add randomly generated
closable tabs, and previous / next / clear buttons that move the active tab
without going through the component at all.

---

# The active tab: a controlled component

## It is the `<input>` pattern, nothing more

If you understand this, you understand the whole feature:

```
   <input>                              <TabBar>
   ───────────────────────────────      ─────────────────────────────────────
   value={text}                         activeTabId={workspace.activeKey}
   onChange={setText}                   onActiveTabSelect={setActiveKey}
      │                                    │
      └─ the input does not remember        └─ the tab bar does not remember
         what you typed; `text` lives           which tab is active; `activeKey`
         in YOUR component                      lives in YOUR component
```

An `<input>` displays `value` and reports "the user typed" via `onChange`. It
stores nothing. That is why you can clear it or restore a draft from a button
somewhere else on the page — you change `text`, and the input follows.

`TabBar` now works identically. `activeTabId` is `value`. `onActiveTabSelect` is
`onChange`.

## Who owns the variable?

That is the entire design decision, and both answers are supported:

```
  ┌─ UNCONTROLLED ─ activeTabId prop omitted ───────────────────────┐
  │                                                                 │
  │   ╔══════════════════════════════════════╗                       │
  │   ║ TabBar                               ║                       │
  │   ║   useState  ◀── owns the active tab  ║                       │
  │   ╚══════════════════════════════════════╝                       │
  │                                                                 │
  │   Simple: <TabBar data={s} forEachTab={f} />                     │
  │   But NOTHING outside the component can change the active tab.   │
  └─────────────────────────────────────────────────────────────────┘

  ┌─ CONTROLLED ─ activeTabId provided ─────────────────────────────┐
  │                                                                 │
  │   ┌──────────────── YOUR COMPONENT ─────────────────┐            │
  │   │  const [workspace, setWorkspace] = useState({   │            │
  │   │      documents: [...],                          │            │
  │   │      activeKey: "d1",   ◀── owns the active tab │            │
  │   │  });                                            │            │
  │   └──┬───────────────────────────────────────▲──────┘            │
  │      │ activeTabId                           │ onActiveTabSelect │
  │      ▼                                       │                   │
  │   ╔══════════════════════════════════════════╧═══╗               │
  │   ║ TabBar    stores nothing, renders what        ║               │
  │   ║           it is told, asks to change it       ║               │
  │   ╚══════════════════════════════════════════════╝               │
  │                                                                 │
  │   ANY code that can call setWorkspace can move the tabs.         │
  └─────────────────────────────────────────────────────────────────┘
```

## The two halves

| Half  | Prop                | Direction        | Analogy    |
| ----- | ------------------- | ---------------- | ---------- |
| READ  | `activeTabId`       | host → component | `value`    |
| WRITE | `onActiveTabSelect` | component → host | `onChange` |

A read-only "controlled" prop is only half the story: it lets the caller dictate
the active tab but gives the component no way to *ask* for a change — so clicking
a tab would do nothing. Both halves are needed.

## Data flow, both modes

```
  UNCONTROLLED                             CONTROLLED
  (activeTabId omitted)                    (activeTabId provided)
  ─────────────────────────────────        ─────────────────────────────────

   user clicks a tab                        user clicks a tab
         │                                       │
         ▼                                       ▼
   TabBar asks itself                      TabBar calls
         │                                 onActiveTabSelect(id, data,
         ▼                                                   "user-select")
   its own useState updates                      │
         │                                       ▼
         ▼                                 YOU call setWorkspace
   TabBar re-renders                             │
                                                 ▼
                                           activeTabId comes back down
                                                 │
                                                 ▼
                                           TabBar re-renders,
                                           storing nothing
```

In controlled mode TabBar has **no write access at all** — not even indirectly.
It calls your function and stops. Whether anything changes is entirely your
decision, which means you can refuse:

```tsx
onActiveTabSelect={(id) => {
    if (hasUnsavedChanges) return;   // ignored — the tab does NOT move
    setWorkspace((p) => ({ ...p, activeKey: id }));
}}
```

## External modification: the point of all this

Nothing below mentions `TabBar`. They all just write `activeKey`, and the tab bar
follows.

```tsx
// a button elsewhere on the page
setWorkspace((p) => ({ ...p, activeKey: "d3" }));

// a keyboard shortcut outside the tab strip
useHotkey("ctrl+tab", () => stepActive(+1));

// a route change
setWorkspace((p) => ({ ...p, activeKey: params.get("tab") }));

// a restored session
setWorkspace(savedSnapshot);

// a test
setWorkspace((p) => ({ ...p, activeKey: "d2" }));
```

```
        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ shortcut │  │  router  │  │   undo   │  │  a test  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │             │
             └─────────────┴──────┬──────┴─────────────┘
                                  │  setWorkspace({ ...activeKey })
                                  ▼
                    ┌─────────────────────────────┐
                    │  workspace.activeKey        │
                    └──────────────┬──────────────┘
                                   │ activeTabId
                                   ▼
                    ╔═════════════════════════════╗
                    ║  TabBar renders and follows ║
                    ╚═════════════════════════════╝
```

## Undo / redo

Because `activeKey` sits inside `workspace` next to `documents`, snapshotting
`workspace` captures the selection too. Undo becomes a plain state write:

```tsx
setWorkspace(previousSnapshot);   // tabs AND selection restored together
```

TabBar never learns that an undo happened. There is nothing to synchronise.

Two things to get right:

- **Don't record `"fallback"` selections as their own undo step.** Closing a tab
  fires `onTabClose` *and* an `onActiveTabSelect(..., "fallback")`. That is one
  user action, so it should be one undo entry — otherwise the first Ctrl+Z only
  restores the selection and the tab comes back on the second press. That is what
  `reason` is for.
- **Snapshot the whole `workspace`, not just `documents`.** Otherwise undo
  restores the tabs but leaves the selection wherever it drifted to.

Whether selection *belongs* in undo history is a product decision, not a
technical one. Some apps undo the edit, not the navigation. If you want that, keep
the active tab in a separate `useState` outside the snapshotted object — the
controlled props work identically either way; only *where* you store the variable
changes.

## `reason`: why the component is asking

```ts
type ActiveTabSelectReason = "user-select" | "fallback";
```

```
  "user-select"   the user clicked or keyed a tab
  "fallback"      the tab you have marked active no longer exists
                  (closed or removed); here is a replacement — the
                  first tab, or null if none remain
```

The `"fallback"` case exists because in controlled mode the component *cannot*
fix a dead active id itself; it doesn't own the value. So it tells you:

```
   you delete the active document from your own state
             │
             ▼
   TabBar's render pass notices the active id is no longer yielded
             │
             ▼
   onActiveTabSelect("d1", data, "fallback")
             │
             ▼
   you setWorkspace(...) — or refuse, and nothing happens
```

Most hosts handle both reasons identically:

```tsx
onActiveTabSelect={(id, _data, reason) => {
    setWorkspace((p) => ({ ...p, activeKey: id }));
}}
```

## `onActiveTabSelect` vs `onActiveTabChange`

Two callbacks, two jobs. Mixing them up is the easiest mistake here:

| Callback            | When            | What it is for            |
| ------------------- | --------------- | ------------------------- |
| `onActiveTabSelect` | *before* — a request | **write** your state |
| `onActiveTabChange` | *after* — a receipt  | **observe** only: logging, analytics, scroll-into-view |

```
   onActiveTabSelect  ──▶  you write state  ──▶  re-render  ──▶  onActiveTabChange
        "please change it"                                          "it changed"
```

Writing state from `onActiveTabChange` is the old mirroring pattern this feature
replaces — it puts you one step behind and gives you two copies of the same fact.

## `undefined` is not `null`

| `activeTabId`  | Mode         | Meaning                                       |
| -------------- | ------------ | --------------------------------------------- |
| omitted        | uncontrolled | "you keep it, TabBar" — seeded by `defaultActiveTabId` |
| `"someId"`     | controlled   | "I'm in charge; that tab is active"           |
| `null`         | controlled   | "I'm in charge; *nothing* is active"          |

Omitting the prop hands ownership back to the component. It does **not** mean
"nothing selected". Pass `null` for the empty selection.

## `index` is derived, not addressable

`onActiveTabChange` reports the active tab's position in the `forEachTab`
traversal, computed for free during the render pass. It is read-only on purpose:

```
   docs:   [ d1 , d2 , d3 ]      activeKey = "d1"  →  index 0
                                                        │
   reorder d2 to the front                              │ id unchanged,
                                                        ▼ index MOVED
   docs:   [ d2 , d1 , d3 ]      activeKey = "d1"  →  index 1
```

An index is not a stable address — closing or reordering shifts it. Always
address tabs by `id`.

---

# Overflow: max width, scrolling, and revealing the active tab

## `maxWidth`

A `number` is pixels (matching React's `style` convention); a `string` goes to CSS
verbatim, so relative and computed units all work:

```tsx
<TabBar maxWidth={400} />                       // max-width: 400px
<TabBar maxWidth="50%" />                       // max-width: 50%
<TabBar maxWidth="clamp(200px, 40vw, 600px)" /> // as written
```

```
  ┌─ parent ───────────────────────────────────────────────┐
  │  ┌─ .tabs   max-width: 400px ───────────────┐          │
  │  │ overflow-x: auto  ← the scroll viewport  │          │
  │  ╞══════════════════════════════════════════╡          │
  │  │ t1 │ t2 │ t3 │ t4 │ t5 │ t6 ┊ t7 … t17              │
  │  └─────────────────────────────┴────────────┘          │
  │      ▲                         ▲    ▲                  │
  │      └──── clientWidth ────────┘    └ clipped, reached  │
  │                                       by scrolling      │
  └────────────────────────────────────────────────────────┘
```

A percentage resolves against the *containing block*, so the parent needs a
definite width for `"50%"` to behave as expected.

Tabs use `flex: 0 0 auto`, so they never compress to fit — past `maxWidth` they
overflow and become scrollable rather than squeezing.

## The scrollbar appears on demand

`Tabs.css` keeps the strip `overflow: hidden` at rest and switches to
`overflow-x: auto` on `:hover`, `:active` and `:focus-within`, so an idle
scrollbar never competes visually with the tabs.

Two details that make this work:

- **`:focus-within`, not `:focus`.** The container has `role="tablist"` but no
  `tabIndex`, so it can never match `:focus`. Individual tabs carry
  `tabIndex={0}`, and `:focus-within` matches while any of them holds focus —
  which is what makes the scrollbar reachable for keyboard users.
- **`scrollbar-gutter: stable`.** Without it, `overflow` flipping to `auto`
  inserts a scrollbar that eats into the fixed `27px` height, and since `.tab` is
  `height: 100%` every tab visibly squashes as the pointer enters. Reserving the
  gutter makes appearing and disappearing reflow-free.

`overflow: hidden` does **not** block programmatic scrolling — `scrollLeft` still
works — so revealing the active tab is unaffected while the bar is hidden.

## Revealing the active tab

When the active tab changes and it lies outside the viewport, the strip scrolls
just far enough to show it.

### Nothing requests a scroll — it is observed

This is the important design property. `useRevealActiveTab` watches `activeId`
and reacts to a *change of value*; it is never called:

```
   coupled                          decoupled (what this does)
   ─────────────────────            ────────────────────────────
   select(id) {                     useLayoutEffect(() => {
       setState(id);                    reveal();
       reveal();  ← the setter      }, [activeId]);
   }             knows about                ▲
                 scrolling                  └─ nobody knows this exists
```

Both behave identically for a click. Only the observing form *also* fires when
the host changes the active tab entirely on its own — a keyboard shortcut, a
route change, an undo — because in that case there is no call site to attach a
`reveal()` to:

```tsx
// Scrolls the tab into view. Mentions neither scrolling nor the component.
setWorkspace((p) => ({ ...p, activeKey: "d17" }));
```

### The arithmetic

One coordinate space: pixels from the container's left content edge.

```
  0                                                       scrollWidth
  ├──────────────────────────────────────────────────────────────┤
  │ t1 │ t2 │ t3 │ t4 │ t5 │ t6 │ t7 │ t8 │ t9 │t10 │t11 │t12 │
           ╞═══════════ clientWidth ═══════════╡
           ▲                                   ▲
     scrollLeft              scrollLeft + clientWidth
```

```
  CASE A — starts before the viewport          → scroll left
     ┌────┐
     │ t2 │      ╞═════════ visible ═════════╡
     └────┘
     delta = start − margin

  CASE B — ends after the viewport             → scroll right
                 ╞═════════ visible ═════════╡      ┌────┐
                                                    │ t12│
                                                    └────┘
     delta = end − clientWidth + margin

  CASE C — already fully visible               → DO NOTHING
                 ╞═════════ visible ═════════╡
                       ┌────┐
                       │ t7 │
                       └────┘
```

Case C makes the operation **minimal and idempotent**: re-revealing a visible tab
never moves the strip. The result is clamped to `[0, scrollWidth − clientWidth]`
so a margin near either end cannot overscroll.

Measured with `getBoundingClientRect`, not `offsetLeft`, because `offsetLeft` is
relative to the nearest *positioned* ancestor and would break silently depending
on the container's `position`. Rect deltas are already relative to the current
scroll offset; subtracting `clientLeft` removes the border so the comparison
against `clientWidth` is exact.

### Why not `scrollIntoView()`

```
   ┌─ the page (scrollable) ─────────────────┐
   │  ...content above...                    │
   │  ┌─ .tabs (scrollable) ──────────┐      │
   │  │ t1 │ t2 │ t3 │ ...            │      │
   │  └───────────────────────────────┘      │
   └─────────────────────────────────────────┘

   scrollIntoView walks up and scrolls EVERY scrollable ancestor
   → selecting a tab can jump the whole page
```

Writing `container.scrollTo({ left })` touches exactly one element.

### `useLayoutEffect`, not `useEffect`

```
  useEffect  (would flash)
  render ─▶ commit ─▶ ▓ PAINT ▓ ─▶ measure ─▶ scroll ─▶ ▓ PAINT ▓
                          │                                 │
                          └── user sees the OLD position ────┘

  useLayoutEffect  (correct)
  render ─▶ commit ─▶ measure ─▶ scroll ─▶ ▓ PAINT ▓
```

Layout effects run after the DOM is committed but before paint, so the correction
lands in the same frame. Most visible on first mount, when the initially active
tab may be far down the strip.

### One trigger, on purpose

```
  event                                  re-reveals?
  ─────────────────────────────────────────────────────
  active tab changed (click or external)     YES
  user scrolled by hand                      no
  unrelated parent re-render                 no
  tab closed / reordered elsewhere           no
  container resized                          no
```

Only `activeId` is a dependency. Adding more triggers — "the active tab moved
because an earlier one closed", "the container resized" — would pull reorder
state, drag state and resize observers into this hook, giving it several
unrelated reasons to change. It would also re-assert scroll position on mutations
the user did not initiate, which is what makes such implementations feel like
they are fighting the pointer.

The trade: reorder or close a tab *before* the active one and the active tab
shifts position without being re-revealed. It stays selected and highlighted,
just possibly scrolled out of view.

### Finding the active tab

`container.querySelector('[role="tab"][aria-selected="true"]')` — reading an
attribute `Tab` already sets for accessibility. This is why `Tab.tsx` needs no ref
plumbing and stays untouched.

### `revealActiveTab`

```tsx
<TabBar revealActiveTab />                              // default: instant
<TabBar revealActiveTab={false} />                      // off
<TabBar revealActiveTab={{ behavior: "smooth" }} />     // animate
<TabBar revealActiveTab={{ margin: 0 }} />              // flush to the edge
```

| Option     | Default     | Meaning                                              |
| ---------- | ----------- | ---------------------------------------------------- |
| `behavior` | `"instant"` | `ScrollBehavior`. Instant by default so it never feels laggy; `"smooth"` is downgraded to instant under `prefers-reduced-motion: reduce`. |
| `margin`   | `8`         | Px of breathing room between the tab and the edge.    |

The behavior is passed per call to `scrollTo`, not set as `scroll-behavior` in
CSS, which keeps the choice in props where a caller can override it.



## Structure

```
  ┌──────────────── YOUR COMPONENT (owns data + active tab) ───────┐
  │  data ↓  forEachTab ↓  activeTabId ↓  maxWidth ↓               │
  │  onTabClose ↑  onTabReorder ↑  onActiveTabSelect ↑             │
  └──────┬─────────────────────────────────────────────────────────┘
         ▼
  ╔══ TabBar.tsx ═════════════════════════════ the coordinator ════╗
  ║  no raw HTML, no primitive state of its own                    ║
  ║                                                               ║
  ║   forEachTab(data, visit)  ── ONE PASS, deriving ──▶            ║
  ║       tabElements[]   firstTabId   activeExists   activeIndex   ║
  ║                                                               ║
  ║   containerRef ─────────────────────────────────┐              ║
  ║                                                 │              ║
  ║  ┌──────────────┐ ┌────────────────┐ ┌──────────▼───────────┐  ║
  ║  │ useActiveTab │ │ useDragReorder │ │ useRevealActiveTab   │  ║
  ║  │  state only  │ │  drag only     │ │  DOM only            │  ║
  ║  │  no DOM      │ │  no scrolling  │ │  no state            │  ║
  ║  └──────┬───────┘ └────────────────┘ └──────────▲───────────┘  ║
  ║         │ activeId        ✗ no link             │              ║
  ║         └───────────────────────────────────────┘              ║
  ╚═══════════════════════════════════════════════════════════════╝
         │
         ▼
  ┌─ Tabs.tsx ─── container markup + THE SCROLL VIEWPORT ─────────┐
  │   ┌─ Tab.tsx ─┐ ┌─ Tab.tsx ─┐ ┌─ Tab.tsx ─┐                   │
  │   │  raw DOM  │ │  events → │ │  semantic │  × n              │
  │   └───────────┘ └───────────┘ └───────────┘                   │
  └───────────────────────────────────────────────────────────────┘
```

Three hooks, one arrow between them. Each has exactly one reason to change:
`useActiveTab` touches no DOM, `useRevealActiveTab` holds no state, and neither
knows `useDragReorder` exists.

## One writer inside `useActiveTab`

Every path that changes the active tab funnels through a single private
`requestChange(id, reason)`:

```
   select(id)        ─┐   from a user click / keypress
                      ├──▶  requestChange(id, reason)
   reconcile(...)    ─┘   from the vanished-tab check
                                    │
                       ┌────────────┴─────────────┐
                       ▼                          ▼
              onActiveTabSelect            controlled?
              fires in BOTH modes            no → setInternalId (applies)
                                             yes → host decides
```

It resolves ownership exactly once, which is what keeps controlled mode a
first-class citizen rather than a mode where half the behavior silently no-ops.

`onActiveTabSelect` firing in *both* modes is deliberate: a host can observe
selection intent without taking ownership.

## The vanished-tab check

```
   render pass:  activeExists = false, firstTabId = "d1"
        │
        ▼
   reconcile(false, "d1")   ← recorded in a ref DURING render
        │
        ▼  useEffect  — never during render, because neither a setState
        │              nor a parent's setter may be called mid-render
   requestChange("d1", "fallback")
        │
        ├─ uncontrolled → setInternalId("d1")
        └─ controlled   → onActiveTabSelect("d1", data, "fallback")

   Guarded: if the proposed replacement already equals the current active
   id, the request is skipped — otherwise a controlled host that ignores
   the fallback would spin in a render loop.
```

## Design principles

- **Data in through props, all reads and writes through callbacks.** The business
  data structure is opaque to the component, so it can be shaped however you
  like.
- **State the caller may own is a controlled prop pair.** Read half plus write
  half, never a read-only prop — `activeTabId` + `onActiveTabSelect`.
- **Iterator, not projection or indexing.** Tabs are read via `forEachTab`, a
  single-pass internal iterator. This avoids an O(n) projection array and avoids
  O(n)-per-lookup random access (which would be O(n²) for a linked list, or
  O(n·log n) for a tree). The first tab, the active-tab existence and the active
  index are all captured during that same pass.
- **Coordinator vs. UI.** `TabBar` coordinates *behavior* and renders no raw
  HTML. The markup lives in the `Tab` / `Tabs` UI components, which also
  translate raw DOM events into high-level semantic events.
- **Focused hooks.** Each intrinsic concern (active-tab management, reorder
  mechanics) is its own hook, so the coordinator holds no primitive state.

## File layout

| File                | Role                                                                         | Exported?  |
| ------------------- | ---------------------------------------------------------------------------- | ---------- |
| `index.tsx`         | Front door. Re-exports the public API only.                                  | -          |
| `TabBar.tsx`        | The behavior coordinator; composes the pieces below.                          | Yes public |
| `types.ts`          | Public contract: `TabBarProps`, `TabDescriptor`, `TabVisitor`, `ActiveTabSelectReason`, `RevealActiveTabOptions`. | Yes public |
| `Tabs.tsx`          | Internal UI: the tab-strip container; also the scroll viewport.               | No private |
| `Tab.tsx`           | Internal UI: a single tab; raw→semantic event translation.                   | No private |
| `useActiveTab.ts`   | Internal hook: active-tab ownership, the single writer, fallback, notify.     | No private |
| `useDragReorder.ts` | Internal hook: drag-to-reorder mechanics (single indexed list).               | No private |
| `useRevealActiveTab.ts` | Internal hook: scroll the active tab into view when it changes.           | No private |
| `Tabs.css`          | Styles for the strip: overflow, on-demand scrollbar, gutter.                  | -          |
| `Tab.css`           | Styles for a tab: active / disabled / close / drop-target.                    | -          |

Only `TabBar` and the types in `types.ts` are exported from `index.tsx`.
Everything else is a private helper whose composition can change freely.

---

# Public API

## `TabBar<TData>` props

| Prop                 | Type                                        | Purpose                                                                |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `data`               | `TData`                                     | Your arbitrary business structure. Opaque to the component.            |
| `forEachTab`         | `(data, visit) => void`                     | Single-pass iterator that yields each tab as a `TabDescriptor`.        |
| `onTabClick`         | `(id, data) => void`                        | Behavior hook: what a click means (caller-defined). Not selection.     |
| `onTabClose`         | `(id, data) => void`                        | Mutate callback: remove the tab from your structure.                   |
| `onTabReorder`       | `(from, to, data) => void`                  | Mutate callback: reorder within your structure.                        |
| `closable`           | `boolean`                                   | Show the × affordance (per-tab override via `TabDescriptor.closable`). |
| `reorderable`        | `boolean`                                   | Enable drag-and-drop reordering.                                       |
| `maxWidth`           | `number \| string`                          | Bound the strip; beyond it, it scrolls. Number ⇒ px, string ⇒ verbatim CSS. |
| `revealActiveTab`    | `boolean \| RevealActiveTabOptions`         | Keep the active tab visible. Default `true`, instant.                  |
| `activeTabId`        | `string \| null`                            | Controlled active tab, READ half. Present ⇒ controlled.                |
| `onActiveTabSelect`  | `(id \| null, data, reason) => void`        | Controlled active tab, WRITE half. A request, which you may refuse.    |
| `onActiveTabChange`  | `(id \| null, index \| null, data) => void` | Notification only: the active tab settled on this id / index.          |
| `defaultActiveTabId` | `string \| null`                            | Initial active tab (uncontrolled); defaults to the first tab.          |
| `className`          | `string`                                    | Extra class on the container.                                          |

`onTabClick` is a free-form behavior hook and fires independently of selection.
It is **not** the selection channel — that is `onActiveTabSelect`.

## `TabDescriptor`

The minimal, presentation-facing shape the component understands:

```ts
interface TabDescriptor {
    id: string;          // stable unique identity (React key + lookups)
    title: ReactNode;    // rendered content
    closable?: boolean;  // per-tab override of the `closable` prop
    disabled?: boolean;  // disable interaction with this tab
}
```

---

# Change log — overflow and revealing (this feature)

## What was added

```
  types.ts                    + maxWidth?: number | string
                              + revealActiveTab?: boolean | RevealActiveTabOptions
                              + RevealActiveTabOptions { behavior, margin }
  useRevealActiveTab.ts       + NEW. Single dep: activeId. Exports
                                revealHorizontally() for testing.
  Tabs.tsx                    ~ accepts ref (the scroll viewport) and maxWidth
  Tabs.css                    ~ :focus → :focus-within (the container is not
                                focusable, so :focus could never match)
                              ~ + scrollbar-gutter: stable, scrollbar-width: thin
                                (stops tabs squashing when the bar appears)
                              ~ KEEPS overflow:hidden + hover-auto by design
  Tab.css                     ~ + flex: 0 0 auto  (overflow, never compress)
  TabBar.tsx                  ~ containerRef; wires the third hook
  index.tsx                   + exports RevealActiveTabOptions
  Tab.tsx                     UNTOUCHED
  useActiveTab.ts             UNTOUCHED
  useDragReorder.ts           UNTOUCHED
  src/main.tsx                ~ 17 generated tabs; add / add-5 / reset buttons
```

`useActiveTab` and `useDragReorder` being untouched is the point: revealing is a
third independent concern that needed no change to either.

## Verification

- **213 tests pass** — 176 pre-existing, 17 for the active-tab port, 20 new for
  overflow and revealing.
- `tsc --noEmit` clean apart from one pre-existing, unrelated error in
  `src/syntax-plugins/math`; `vite build` succeeds.
- Both new suites were confirmed to *bite*. Removing CASE C failed 3 tests;
  changing the effect's dependency to "every render" failed the
  don't-fight-the-user test.

Coverage:

```
  arithmetic       CASE A / B / C
                   idempotent (revealing twice does not move)
                   clamped at the far end, never below zero
                   zero margin honoured

  when it fires    external activeTabId change → reveals
                   user click → reveals
                   newly active tab already visible → no scroll
                   unrelated re-render while the user has scrolled
                     away → no scroll  ← the fighting-the-user case
                   revealActiveTab={false} → nothing
                   nothing active → nothing

  behavior         defaults to "instant"
                   "smooth" honoured
                   "smooth" downgraded under prefers-reduced-motion

  maxWidth         number → px, string → verbatim, omitted → no style
```

jsdom has no layout engine, so the tests fake element geometry (rects,
`clientWidth`, `scrollWidth`) around the real component DOM. The arithmetic and
the hook's decisions are genuinely exercised; actual browser layout is not.

## Known limits

**Content-width changes do not retrigger.** If a tab *before* the active one gets
wider — a `dirty` marker appearing, a late-loading font — the active tab shifts
without being re-revealed. Fixable with a `ResizeObserver` on the content; not
built, on the same "one trigger" reasoning.

**Edge auto-scroll during drag is a separate feature.** Dragging a tab toward the
container edge ought to scroll the strip. That belongs to `useDragReorder`, which
deliberately is not a general DnD framework.

**RTL is untested.** `scrollLeft` semantics differ in right-to-left writing modes.
The rect-delta math should mostly survive, but this is not verified.

---

# Change log — the controlled active tab

## Before

The active tab lived inside `TabBar`. `activeTabId?: string` was read-only, so
the only way a host could learn about selection was after the fact, and the demo
mirrored it into its own state:

```tsx
// OLD — TabBar decided, then told you, and you kept a COPY
onActiveTabChange={(tabId) =>
    setWorkspace((prev) => ({ ...prev, activeKey: tabId }))
}
```

```
   ╔═══════════════════════╗                ┌──────────────────────┐
   ║ TabBar                ║                │ your state           │
   ║   internalId = "d2" ──╫── notify ─────▶│   activeKey = "d2"   │
   ║   ▲ the real one      ║                │   ▲ a stale copy     │
   ╚═══════════════════════╝                └──────────────────────┘
        nothing outside could write it — only observe it
```

## After

```
   ┌──────────────────────┐                 ╔═══════════════════════╗
   │ your state           │─ activeTabId ──▶║ TabBar                ║
   │   activeKey = "d2"   │                 ║   stores nothing      ║
   │   ▲ the ONLY copy    │◀─ onActive ─────╢   asks to change it   ║
   └──────────────────────┘   TabSelect     ╚═══════════════════════╝
        anything that can write activeKey can move the tabs
```

## Files changed

| File                   | Change                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`             | `activeTabId` widened to `string \| null`; added `onActiveTabSelect` and `ActiveTabSelectReason`; `onActiveTabChange` gained `index`. |
| `useActiveTab.ts`      | All writes funnel through one private `requestChange(id, reason)`; `reconcile` now reports in controlled mode too; callbacks held in refs so `select` stays referentially stable. |
| `TabBar.tsx`           | `activeIndex` captured in the existing single traversal (no extra pass); wires `onActiveTabSelect` through.                        |
| `index.tsx`            | Exports `ActiveTabSelectReason`.                                                                                                   |
| `Tab.tsx`, `Tabs.tsx`, `useDragReorder.ts`, `Tab.css`, `Tabs.css` | **Untouched.**                                                                          |
| `src/main.tsx`         | Demo converted to controlled mode, plus previous / next / clear buttons that bypass the component entirely.                        |

## Bugs fixed along the way

**1. `null` was not expressible.** `activeTabId?: string` plus
`isControlled = controlledId !== undefined` meant a host wanting "nothing active"
passed `undefined`, silently lost control, and had stale internal state
resurrected.

```
   OLD:  activeTabId={undefined}  ──▶  "uncontrolled"  ──▶  stale tab reappears
   NEW:  activeTabId={null}       ──▶  controlled, nothing selected
```

**2. Controlled mode was never told its active tab had died.** `reconcile`
early-returned when controlled, discarding the `activeExists` fact the render pass
had *already computed*. It now surfaces as
`onActiveTabSelect(replacementId, data, "fallback")`.

**3. `onTabClick` was doing double duty.** It was documented as a free-form
behavior hook, but in controlled mode it was the *only* channel for selection
intent — so a host that used it for analytics and forgot to set state got a tab
bar where clicking did nothing, with no hint why. Selection now has its own
callback.

## Verification

- **193 tests pass** — 176 pre-existing, plus 17 new in
  `tests/views/tab-bar.test.tsx`.
- `tsc --noEmit` clean apart from one pre-existing, unrelated error in
  `src/syntax-plugins/math`.
- `vite build` succeeds.
- The new tests were confirmed to *bite*: temporarily restoring the old
  `isControlled` early-return in `reconcile` failed exactly the three fallback
  tests, and reverting it fixed them.

Test coverage, by area:

```
  read half        controlled tab renders active
                   null means "nothing active", not uncontrolled
                   follows external modification (button outside the component)

  write half       requests on click, tagged "user-select"
                   host refusing the request → tab does not move
                   also fires in uncontrolled mode

  fallback         controlled host IS told (the old bug)
                   proposes null when no tabs remain
                   no render loop when the host ignores it
                   uncontrolled mode still self-heals

  notification     reports id + derived index
                   null index when nothing is active
                   index tracks a reorder while the id stays put

  regression       uncontrolled defaults to first tab
                   defaultActiveTabId honoured
                   click selects
                   onTabClick fires independently of selection
```

The test suite needed a DOM environment, which the project did not have. Added as
pinned dev dependencies: `jsdom@27.0.0` and `@testing-library/react@16.3.0`.
`vite.config.ts` sets `test.environment: "node"` and the new suite opts into jsdom
via a `// @vitest-environment jsdom` docblock, so the existing parser tests stay
fast.

---

# Scope notes

`useDragReorder` handles reordering within a **single** indexed list only. It is
deliberately not a general drag-and-drop framework: no cross-container drags, no
insert-before/after positions, no touch/pointer fallback, no custom previews.
For those, reach for a dedicated DnD library rather than growing this hook.

Things considered for the active tab and deliberately **not** built, because the
controlled prop pair already covers them:

- An imperative ref handle (`ref.current.setActive(id)`) — refs don't subscribe,
  so the parent would have to mirror the value back out, reintroducing two copies
  of the same fact.
- An external-store adapter object — any store can already be wired up inline:
  `activeTabId={store.activeTab}` / `onActiveTabSelect={store.setActiveTab}`.
- A separate veto callback — refusing a request is already just *not* acting on
  `onActiveTabSelect`.
