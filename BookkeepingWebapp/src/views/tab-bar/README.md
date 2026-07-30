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

See `src/main.tsx` (`DataDrivenTabBarDemo`) for a full working example, including
buttons that move the active tab without going through the component at all.

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

# Internals

## Structure

```
  ┌──────────────── YOUR COMPONENT (owns data + active tab) ───────┐
  │  data ↓  forEachTab ↓  activeTabId ↓                           │
  │  onTabClose ↑  onTabReorder ↑  onActiveTabSelect ↑             │
  └──────┬─────────────────────────────────────────────────────────┘
         ▼
  ╔══ TabBar.tsx ═════════════════════════════ the coordinator ════╗
  ║  no raw HTML, no primitive state of its own                    ║
  ║                                                               ║
  ║   forEachTab(data, visit)  ── ONE PASS, deriving ──▶            ║
  ║       tabElements[]   firstTabId   activeExists   activeIndex   ║
  ║                                                               ║
  ║   ┌──────────────────────┐   ┌────────────────────────────┐    ║
  ║   │ useActiveTab         │   │ useDragReorder             │    ║
  ║   │  which tab is active │   │  drag-to-reorder mechanics │    ║
  ║   └──────────────────────┘   └────────────────────────────┘    ║
  ╚═══════════════════════════════════════════════════════════════╝
         │
         ▼
  ┌─ Tabs.tsx ─── the container markup ───────────────────────────┐
  │   ┌─ Tab.tsx ─┐ ┌─ Tab.tsx ─┐ ┌─ Tab.tsx ─┐                   │
  │   │  raw DOM  │ │  events → │ │  semantic │  × n              │
  │   └───────────┘ └───────────┘ └───────────┘                   │
  └───────────────────────────────────────────────────────────────┘
```

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
| `types.ts`          | Public contract: `TabBarProps`, `TabDescriptor`, `TabVisitor`, `ActiveTabSelectReason`. | Yes public |
| `Tabs.tsx`          | Internal UI: the tab-strip container markup.                                 | No private |
| `Tab.tsx`           | Internal UI: a single tab; raw→semantic event translation.                   | No private |
| `useActiveTab.ts`   | Internal hook: active-tab ownership, the single writer, fallback, notify.     | No private |
| `useDragReorder.ts` | Internal hook: drag-to-reorder mechanics (single indexed list).               | No private |
| `Tabs.css`          | Styles for the tab-strip container.                                          | -          |
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
