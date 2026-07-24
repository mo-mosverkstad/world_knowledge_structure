import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import "./style.css";
import { Tabs } from "./Tabs";
import { Tab } from "./Tab";

/**
 * TabBar — a *data-driven* tab bar and behavior COORDINATOR.
 *
 * Architecture
 * ------------
 * `TabBar` deliberately renders NO raw HTML. It composes two internal, private
 * helper components:
 *
 *   - `Tabs`  — owns the container markup.
 *   - `Tab`   — owns a single tab's markup and wraps raw DOM events into
 *               high-level semantic events (onSelect / onClose / onReorder*).
 *
 * Neither `Tabs` nor `Tab` is exported; changing their composition or DOM does
 * not touch this file. `TabBar`'s sole job is to *coordinate behavior*: iterate
 * the data port, decide which tab is active, and react to the semantic events
 * the UI layer emits. It never asks "what element should this be" — only "what
 * should happen".
 *
 * Data-driven contract
 * --------------------
 * The component knows NOTHING about the shape of your business data. The caller
 * passes:
 *   1. `data`        — the DATA PORT: an arbitrary business data structure.
 *   2. `forEachTab`  — an INTERNAL ITERATOR: the caller traverses its own
 *                      structure exactly once and yields each tab into the
 *                      visitor the component supplies. This avoids both an O(n)
 *                      projection array and O(n)-per-lookup random access
 *                      (which would be O(n^2) for lists / O(n log n) for trees).
 *   3. mutate cbs    — `onTabClose`, `onTabReorder`.
 *   4. behavior hooks— `onTabClick`, `onActiveTabChange` (caller-defined).
 */

/**
 * The minimal, presentation-facing description of a single tab.
 *
 * This is the *only* shape the component understands. The caller yields these
 * out of its arbitrary business data (`TData`) via {@link TabBarProps.forEachTab}.
 */
export interface TabDescriptor {
    /** Stable, unique identity for the tab. Used as React key and for lookups. */
    id: string;
    /** What is rendered inside the tab. Can be plain text or arbitrary nodes. */
    title: ReactNode;
    /**
     * Optional per-tab override for closability. When omitted, the tab bar's
     * `closable` prop decides. Lets the caller pin specific tabs open.
     */
    closable?: boolean;
    /** Optional flag to disable interaction with a single tab. */
    disabled?: boolean;
}

/**
 * Visitor invoked once per tab, in order, during a single traversal of the
 * business data. `index` is the 0-based position in that traversal.
 */
export type TabVisitor = (tab: TabDescriptor, index: number) => void;

export interface TabBarProps<TData> {
    // ---- DATA PORT -----------------------------------------------------
    /**
     * The business data structure. Opaque to the component; only the callbacks
     * below give it meaning.
     */
    data: TData;

    // ---- INTERNAL ITERATOR (read the data port in one pass) ------------
    /**
     * Traverse `data` exactly once, calling `visit(tab, index)` for every tab
     * in display order. The caller is free to walk an array, a linked list, a
     * B+ tree, etc. The component performs no random access and builds no
     * intermediate array; everything it needs (rendered elements, first-tab id,
     * active-tab existence) is gathered during this single pass.
     */
    forEachTab: (data: TData, visit: TabVisitor) => void;

    // ---- MUTATE CALLBACKS (operate on the data port) -------------------
    /**
     * Requested when the user closes a tab (only reachable when closing is
     * enabled). The caller performs the actual mutation on its own data
     * structure and passes back updated `data` on the next render.
     */
    onTabClose?: (tabId: string, data: TData) => void;
    /**
     * Requested when the user drags a tab to a new position (only reachable
     * when `reorderable` is true). Indices refer to positions in the traversal
     * order produced by `forEachTab`.
     */
    onTabReorder?: (fromIndex: number, toIndex: number, data: TData) => void;

    // ---- BEHAVIOR HOOKS (caller-defined side effects) ------------------
    /**
     * Fired when a tab is clicked. The meaning of "clicking a tab" is entirely
     * up to the caller — the component only reports it.
     */
    onTabClick?: (tabId: string, data: TData) => void;
    /**
     * Fired whenever the active tab changes (by click, by close of the active
     * tab, or programmatically). Useful for controlled setups or side effects.
     */
    onActiveTabChange?: (tabId: string | null, data: TData) => void;

    // ---- CUSTOMIZATION -------------------------------------------------
    /** Show a delete (×) affordance and allow tabs to be closed. Default: false. */
    closable?: boolean;
    /** Allow tabs to be reordered via drag & drop. Default: false. */
    reorderable?: boolean;

    // ---- ACTIVE-TAB CONTROL --------------------------------------------
    /**
     * Controlled active tab id. When provided, the component defers to the
     * caller for the active tab and will not track it internally.
     */
    activeTabId?: string;
    /**
     * Initial active tab id for the uncontrolled case. When omitted, the first
     * tab yielded by `forEachTab` becomes active (resolved during the first
     * traversal — no separate accessor needed).
     */
    defaultActiveTabId?: string;

    /** Optional extra class name for the outer container. */
    className?: string;
}

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

    const isControlled = activeTabId !== undefined;

    // ---- Encapsulated concern: remember the active tab ----------------
    const [internalActiveId, setInternalActiveId] = useState<string | null>(
        defaultActiveTabId ?? null,
    );
    const resolvedActiveId = isControlled ? activeTabId : internalActiveId;

    // ---- Encapsulated concern: track an in-flight drag ----------------
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // ---- Semantic-event handlers (behavior coordination only) ---------
    const handleSelect = useCallback(
        (tab: TabDescriptor) => {
            if (!isControlled) setInternalActiveId(tab.id);
            onTabClick?.(tab.id, data);
        },
        [isControlled, onTabClick, data],
    );

    const handleClose = useCallback(
        (tabId: string) => {
            onTabClose?.(tabId, data);
        },
        [onTabClose, data],
    );

    const handleReorderStart = useCallback((index: number) => {
        setDragIndex(index);
    }, []);

    const handleReorderOver = useCallback(
        (index: number) => {
            if (dragIndex === null) return;
            setDragOverIndex(index);
        },
        [dragIndex],
    );

    const handleReorderDrop = useCallback(
        (toIndex: number) => {
            if (dragIndex !== null && dragIndex !== toIndex) {
                onTabReorder?.(dragIndex, toIndex, data);
            }
            setDragIndex(null);
            setDragOverIndex(null);
        },
        [dragIndex, onTabReorder, data],
    );

    const handleReorderEnd = useCallback(() => {
        setDragIndex(null);
        setDragOverIndex(null);
    }, []);

    // ---- Single traversal via the caller's iterator ------------------
    // Composition, not construction: the coordinator maps each descriptor onto
    // a <Tab> and lets that component decide its own markup/events. The pass
    // also captures the first tab id and active-tab existence for free.
    const tabElements: ReactNode[] = [];
    let firstTabId: string | null = null;
    let activeExists = false;

    forEachTab(data, (tab, index) => {
        if (index === 0) firstTabId = tab.id;
        if (tab.id === resolvedActiveId) activeExists = true;

        tabElements.push(
            <Tab
                key={tab.id}
                title={tab.title}
                active={tab.id === resolvedActiveId}
                disabled={tab.disabled}
                closable={(tab.closable ?? closable) && onTabClose !== undefined}
                draggable={reorderable}
                dropTarget={dragOverIndex === index && dragIndex !== index}
                onSelect={() => handleSelect(tab)}
                onClose={() => handleClose(tab.id)}
                onReorderStart={() => handleReorderStart(index)}
                onReorderOver={() => handleReorderOver(index)}
                onReorderDrop={() => handleReorderDrop(index)}
                onReorderEnd={handleReorderEnd}
            />,
        );
    });

    // ---- Active-tab validity (uses flags from the pass; no rescan) ----
    useEffect(() => {
        if (isControlled) return;
        if (!activeExists) setInternalActiveId(firstTabId);
    }, [isControlled, activeExists, firstTabId]);

    // ---- Notify the caller when the active tab actually changes -------
    const prevActiveRef = useRef<string | null>(resolvedActiveId ?? null);
    useEffect(() => {
        if (prevActiveRef.current !== resolvedActiveId) {
            prevActiveRef.current = resolvedActiveId ?? null;
            onActiveTabChange?.(resolvedActiveId ?? null, data);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedActiveId]);

    return (
        <Tabs className={className}>{tabElements}</Tabs>
    );
}

export default TabBar;
