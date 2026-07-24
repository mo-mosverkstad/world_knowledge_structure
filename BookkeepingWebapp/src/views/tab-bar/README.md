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
    closable
    reorderable
/>;
```

See `src/main.tsx` (`DataDrivenTabBarDemo`) for a full working example.

## Design principles

- **Data port + callbacks, no coupling.** The business data structure is passed
  through `data` and is opaque to the component. All reads/writes go through
  callbacks, so the data structure can be shaped however you like.
- **Iterator, not projection or indexing.** Tabs are read via `forEachTab`, a
  single-pass internal iterator. This avoids an O(n) projection array and avoids
  O(n)-per-lookup random access (which would be O(n²) for a linked list, or
  O(n·log n) for a tree). The first tab and active-tab existence are captured
  during that same pass.
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
| `types.ts`         | Public data contract: `TabBarProps`, `TabDescriptor`, `TabVisitor`.  | Yes public |
| `Tabs.tsx`         | Internal UI: the tab-strip container markup.                         | No private |
| `Tab.tsx`          | Internal UI: a single tab; raw→semantic event translation.           | No private |
| `useActiveTab.ts`  | Internal hook: active-tab state, selection, fallback, change notify. | No private |
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
| `onActiveTabChange`  | `(id \| null, data) => void`                            | Fires when the active tab changes.                                  |
| `closable`           | `boolean`                                               | Show the × affordance (per-tab override via `TabDescriptor.closable`). |
| `reorderable`        | `boolean`                                               | Enable drag-and-drop reordering.                                    |
| `activeTabId`        | `string`                                                | Controlled active tab.                                              |
| `defaultActiveTabId` | `string`                                                | Initial active tab (uncontrolled); defaults to the first tab.       |
| `className`          | `string`                                                | Extra class on the container.                                       |

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
