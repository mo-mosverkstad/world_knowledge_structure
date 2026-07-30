# TabBar

A **data-driven** tab bar component. It knows nothing about the shape of your
business data: you pass the data through a single port and tell the component
how to read and mutate it via callbacks. The component owns only what is
intrinsic to *being a tab bar* - presenting tabs, remembering the active one,
and offering optional close / reorder affordances.

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

See `src/main.tsx` (`DataDrivenTabBarDemo`) for a full working example.

## Design principles

- **Data port + callbacks, no coupling.** The business data structure is passed
  through `data` and is opaque to the component. All reads/writes go through
  callbacks, so the data structure can be shaped however you like.
- **Ports have two halves.** Anything the caller may own is exposed as a read
  half plus a write half — `data`/`onTabClose` for the tabs, and
  `activeTabId`/`onActiveTabSelect` for the active tab. A read-only "controlled"
  prop is only half a port: it lets the caller dictate state but gives the
  component no way to ask for a change.
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

| File               | Role                                                                 | Exported? |
| ------------------ | -------------------------------------------------------------------- | --------- |
| `index.tsx`        | Front door. Re-exports the public API only.                          | -         |
| `TabBar.tsx`       | The behavior coordinator; composes the pieces below.                 | Yes public |
| `types.ts`         | Public data contract: `TabBarProps`, `TabDescriptor`, `TabVisitor`, `ActiveTabSelectReason`. | Yes public |
| `Tabs.tsx`         | Internal UI: the tab-strip container markup.                         | No private |
| `Tab.tsx`          | Internal UI: a single tab; raw→semantic event translation.           | No private |
| `useActiveTab.ts`  | Internal hook: active-tab ownership, single-writer funnel, fallback, notify. | No private |
| `useDragReorder.ts`| Internal hook: drag-to-reorder mechanics (single indexed list).      | No private |
| `style.css`        | Styles for the container, tabs, active/disabled, close, drop-target. | -         |

Only `TabBar` and the types in `types.ts` are exported from `index.tsx`.
Everything else is a private helper whose composition can change freely.

## Public API

### `TabBar<TData>` props

| Prop                 | Type                                                    | Purpose                                                              |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `data`               | `TData`                                                 | The data port - your arbitrary business structure.                  |
| `forEachTab`         | `(data, visit) => void`                                 | Single-pass iterator that yields each tab as a `TabDescriptor`.     |
| `onTabClick`         | `(id, data) => void`                                    | Behavior hook: what a click means (caller-defined).                 |
| `onTabClose`         | `(id, data) => void`                                    | Mutate callback: remove the tab from your structure.                |
| `onTabReorder`       | `(from, to, data) => void`                              | Mutate callback: reorder within your structure.                     |
| `closable`           | `boolean`                                               | Show the × affordance (per-tab override via `TabDescriptor.closable`). |
| `reorderable`        | `boolean`                                               | Enable drag-and-drop reordering.                                    |
| `activeTabId`        | `string \| null`                                        | Active-tab port, READ half. Present ⇒ controlled.                   |
| `onActiveTabSelect`  | `(id \| null, data, reason) => void`                    | Active-tab port, WRITE half. A request to change the active tab.    |
| `onActiveTabChange`  | `(id \| null, index \| null, data) => void`             | Notification: the active tab settled on this id/index.              |
| `defaultActiveTabId` | `string \| null`                                        | Initial active tab (uncontrolled); defaults to the first tab.       |
| `className`          | `string`                                                | Extra class on the container.                                       |

### The active-tab port

Which tab is active is **caller policy**, not something intrinsic to being a tab
bar. So it is exposed as a port with two halves, exactly like `value`/`onChange`
on an `<input>`:

| Half  | Prop                | Direction        |
| ----- | ------------------- | ---------------- |
| READ  | `activeTabId`       | host → component |
| WRITE | `onActiveTabSelect` | component → host |

Supply both and the host owns the active tab — which means **anything in the host
can change it**: a keyboard shortcut outside the strip, a route change, a
restored session, an undo/redo stack, a test. The component just renders what it
is told.

```tsx
const [activeId, setActiveId] = useState<string | null>("d1");

<TabBar
    data={state}
    forEachTab={forEachTab}
    activeTabId={activeId}                       // read half
    onActiveTabSelect={(id) => setActiveId(id)}  // write half
/>;

// External modification — never touches the component:
setActiveId("d3");
```

#### Controlled vs uncontrolled

| `activeTabId`   | Mode         | Who owns the active tab                              |
| --------------- | ------------ | ---------------------------------------------------- |
| omitted         | uncontrolled | the component, seeded by `defaultActiveTabId`        |
| `"someId"`      | controlled   | you — that tab is active                             |
| `null`          | controlled   | you — *nothing* is active                            |

`undefined` means "you own it", **not** "nothing active". Pass `null` for the
empty selection.

`onActiveTabSelect` fires in **both** modes, so a host can observe selection
intent without taking ownership. In controlled mode it is the component's only
channel: ignore the request and nothing changes. That is deliberate — it lets a
host redirect, defer or refuse a selection (an unsaved-changes guard, say).

#### `reason`

```ts
type ActiveTabSelectReason = "user-select" | "fallback";
```

- `"user-select"` — the user clicked or keyed a tab.
- `"fallback"` — the active tab is no longer yielded by `forEachTab` (closed or
  removed), so the component proposes a replacement: the first tab, or `null` if
  none remain. **Controlled hosts get this too**, which is how you learn that
  the id you hold is dead instead of silently rendering nothing selected.

#### `index` is derived, not addressable

`onActiveTabChange` reports the active tab's position in the `forEachTab`
traversal, computed for free during the render pass. It is read-only on purpose:
an index is not a stable address, since closing or reordering shifts it. Always
address tabs by `id`.

#### One writer

Internally every path that changes the active tab — user activation and
vanished-tab fallback — funnels through a single private `requestChange(id,
reason)` in `useActiveTab`. It resolves ownership once: write internal state when
uncontrolled, ask the host when controlled. That symmetry is what keeps
controlled mode a first-class citizen rather than a mode where half the behavior
silently no-ops.

### `TabDescriptor`

The minimal, presentation-facing shape the component understands:

```ts
interface TabDescriptor {
    id: string;          // stable unique identity (React key + lookups)
    title: ReactNode;    // rendered content
    closable?: boolean;  // per-tab override of the `closable` prop
    disabled?: boolean;  // disable interaction with this tab
}
```

## Scope notes

`useDragReorder` handles reordering within a **single** indexed list only. It is
deliberately not a general drag-and-drop framework: no cross-container drags, no
insert-before/after positions, no touch/pointer fallback, no custom previews.
For those, reach for a dedicated DnD library rather than growing this hook.
