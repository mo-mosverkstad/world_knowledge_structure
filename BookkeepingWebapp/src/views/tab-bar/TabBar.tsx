import { type ReactNode } from "react";
import "./style.css";
import { Tabs } from "./Tabs";
import { Tab } from "./Tab";
import { useActiveTab } from "./useActiveTab";
import { useDragReorder } from "./useDragReorder";
import { type TabBarProps, type TabDescriptor } from "./types";

/**
 * TabBar - a data-driven tab bar and behavior coordinator.
 *
 * Architecture
 * ------------
 * `TabBar` renders no raw HTML and holds no primitive state of its own. It is a
 * thin composition of focused pieces, each defined in its own module:
 *
 *   - `types.ts`         - the public data contract (props, descriptors).
 *   - `Tabs` / `Tab`     - internal UI: container and single-tab markup. `Tab`
 *                          also wraps raw DOM events into semantic ones
 *                          (onSelect / onClose) and spreads drag props.
 *   - `useActiveTab`     - the "which tab is active" concern (controlled/
 *                          uncontrolled, selection, fallback, change notify).
 *   - `useDragReorder`   - the drag-to-reorder mechanics.
 *
 * The coordinator's sole job is to *coordinate behavior*: drive one traversal of
 * the data port, wire the two hooks together, and map each descriptor onto a
 * `<Tab>`. It never asks "what element should this be" - only "what happens".
 *
 * Data-driven contract (see `types.ts` for full docs)
 * ---------------------------------------------------
 *   1. `data`        - the DATA PORT: an arbitrary business data structure.
 *   2. `forEachTab`  - an INTERNAL ITERATOR over that structure (single pass,
 *                      no projection array, no random access).
 *   3. mutate cbs    - `onTabClose`, `onTabReorder`.
 *   4. behavior hooks- `onTabClick`, `onActiveTabChange` (caller-defined).
 */
export function TabBar<TData>(props: TabBarProps<TData>) {
    const {
        data,
        forEachTab,
        onTabClose,
        onTabReorder,
        onTabClick,
        onActiveTabChange,
        closable = false,
        reorderable = false,
        activeTabId,
        defaultActiveTabId,
        className,
    } = props;

    // ---- Encapsulated concern: active-tab management ------------------
    const active = useActiveTab({
        controlledId: activeTabId,
        defaultId: defaultActiveTabId,
        onChange: (id) => onActiveTabChange?.(id, data),
    });

    // ---- Encapsulated concern: drag-to-reorder mechanics --------------
    const reorder = useDragReorder({
        onReorder: onTabReorder
            ? (from, to) => onTabReorder(from, to, data)
            : undefined,
        enabled: reorderable,
    });

    // ---- Semantic-event handlers (behavior coordination only) ---------
    const handleSelect = (tab: TabDescriptor) => {
        active.select(tab.id);
        onTabClick?.(tab.id, data);
    };

    const handleClose = (tabId: string) => {
        onTabClose?.(tabId, data);
    };

    // ---- Single traversal via the caller's iterator ------------------
    // Composition, not construction: map each descriptor onto a <Tab>. The pass
    // also captures the first tab id and active-tab existence for free, which
    // are handed to useActiveTab for fallback reconciliation.
    const tabElements: ReactNode[] = [];
    let firstTabId: string | null = null;
    let activeExists = false;

    forEachTab(data, (tab, index) => {
        if (index === 0) firstTabId = tab.id;
        if (tab.id === active.activeId) activeExists = true;

        tabElements.push(
            <Tab
                key={tab.id}
                title={tab.title}
                active={tab.id === active.activeId}
                disabled={tab.disabled}
                closable={(tab.closable ?? closable) && onTabClose !== undefined}
                dropTarget={reorder.isDropTarget(index)}
                dragProps={reorderable ? reorder.getDragProps(index) : undefined}
                onSelect={() => handleSelect(tab)}
                onClose={() => handleClose(tab.id)}
            />,
        );
    });

    // If the active tab vanished (e.g. it was closed), fall back to the first.
    active.reconcile(activeExists, firstTabId);

    return <Tabs className={className}>{tabElements}</Tabs>;
}

export default TabBar;
