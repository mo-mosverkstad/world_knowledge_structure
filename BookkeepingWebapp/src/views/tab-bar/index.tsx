import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import "./style.css";

/**
 * TabBar — a *data-driven* tab bar component.
 *
 * Design rationale
 * ----------------
 * The component owns ONLY what is intrinsic to "being a tab bar":
 *   - the presentation of a row of tabs,
 *   - remembering / switching the active tab,
 *   - offering (optional) close and reorder affordances.
 *
 * It knows NOTHING about the shape of your business data. Instead of coupling
 * the component to a fixed data structure, the caller passes:
 *
 *   1. `data`          — the DATA PORT: an arbitrary business data structure.
 *   2. `forEachTab`    — an INTERNAL ITERATOR: the caller traverses its own
 *                        structure exactly once and yields each tab into the
 *                        visitor the component supplies.
 *   3. mutate callbacks— how to *manipulate* that data when the user closes or
 *                        reorders a tab (`onTabClose`, `onTabReorder`).
 *   4. behavior hooks  — what should *happen* on interactions (`onTabClick`,
 *                        `onActiveTabChange`). These are defined by the caller,
 *                        never by the component.
 *
 * Why an internal iterator instead of `getTabAt(data, i)` / `getTabs(data)`?
 * -------------------------------------------------------------------------
 *   - `getTabs(data) => TabDescriptor[]` allocates an O(n) intermediate array
 *     every render.
 *   - `getTabAt(data, i)` called in a loop is O(1) *only* for arrays. For a
 *     linked list the n-th lookup is O(n) → O(n^2) overall; for a balanced
 *     tree each lookup re-descends O(log n) → O(n log n) overall.
 *
 * `forEachTab` sidesteps both: the caller walks its structure once (O(n) for a
 * list, O(n) for an in-order tree walk — a single log n descent amortized away)
 * and pushes elements out. The component allocates nothing beyond the React
 * children it must produce anyway, and the "first tab" needed for active-tab
 * fallback is captured during that same single pass (index 0), so no separate
 * random-access accessor is required.
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
     * B+ tree, etc. — whatever its native traversal is. The component performs
     * no random access and builds no intermediate array; everything it needs
     * (rendered elements, first-tab id, active-tab existence) is gathered
     * during this single pass.
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

    // ---- Encapsulated tab-bar concern: remember the active tab ---------
    // In uncontrolled mode we track the active tab ourselves. We cannot (and
    // must not) random-access the data to seed this, so we start from the
    // explicit default or null; if null/stale, the render pass below discovers
    // the first tab and the effect adopts it.
    const [internalActiveId, setInternalActiveId] = useState<string | null>(
        defaultActiveTabId ?? null,
    );

    const resolvedActiveId = isControlled ? activeTabId : internalActiveId;

    // ---- Drag & drop reordering state (opt-in via `reorderable`) -------
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const activate = useCallback(
        (id: string) => {
            if (!isControlled) setInternalActiveId(id);
        },
        [isControlled],
    );

    const handleTabClick = useCallback(
        (tab: TabDescriptor) => {
            if (tab.disabled) return;
            activate(tab.id);
            onTabClick?.(tab.id, data);
        },
        [activate, onTabClick, data],
    );

    const handleClose = useCallback(
        (e: React.MouseEvent, tabId: string) => {
            // Don't let the close click also select the tab.
            e.stopPropagation();
            onTabClose?.(tabId, data);
        },
        [onTabClose, data],
    );

    const handleDragStart = useCallback((index: number) => {
        setDragIndex(index);
    }, []);

    const handleDragOver = useCallback(
        (e: React.DragEvent, index: number) => {
            if (dragIndex === null) return;
            e.preventDefault(); // allow drop
            setDragOverIndex(index);
        },
        [dragIndex],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent, toIndex: number) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== toIndex) {
                onTabReorder?.(dragIndex, toIndex, data);
            }
            setDragIndex(null);
            setDragOverIndex(null);
        },
        [dragIndex, onTabReorder, data],
    );

    const handleDragEnd = useCallback(() => {
        setDragIndex(null);
        setDragOverIndex(null);
    }, []);

    // ---- Single traversal via the caller's iterator -------------------
    // One pass over the caller's structure produces (a) the rendered elements,
    // (b) the first tab id (captured at index 0 — our mitigation for "0th
    // element access" so no getTabAt is needed), and (c) whether the active
    // tab still exists. No intermediate array, no random access, no rescan.
    const tabElements: ReactNode[] = [];
    let firstTabId: string | null = null;
    let activeExists = false;

    forEachTab(data, (tab, index) => {
        if (index === 0) firstTabId = tab.id;
        if (tab.id === resolvedActiveId) activeExists = true;

        const isActive = tab.id === resolvedActiveId;
        const tabClosable =
            (tab.closable ?? closable) && onTabClose !== undefined;
        const classes = ["tab"];
        if (isActive) classes.push("tab--active");
        if (tab.disabled) classes.push("tab--disabled");
        if (dragOverIndex === index && dragIndex !== index)
            classes.push("tab--drop-target");

        // Snapshot the index for the handlers to close over.
        const i = index;

        tabElements.push(
            <div
                key={tab.id}
                className={classes.join(" ")}
                role="tab"
                aria-selected={isActive}
                aria-disabled={tab.disabled || undefined}
                tabIndex={tab.disabled ? -1 : 0}
                draggable={reorderable && !tab.disabled}
                onClick={() => handleTabClick(tab)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleTabClick(tab);
                    }
                }}
                onDragStart={
                    reorderable ? () => handleDragStart(i) : undefined
                }
                onDragOver={
                    reorderable ? (e) => handleDragOver(e, i) : undefined
                }
                onDrop={reorderable ? (e) => handleDrop(e, i) : undefined}
                onDragEnd={reorderable ? handleDragEnd : undefined}
            >
                <span className="tab__title">{tab.title}</span>
                {tabClosable && (
                    <button
                        type="button"
                        className="tab__close"
                        aria-label="Close tab"
                        onClick={(e) => handleClose(e, tab.id)}
                    >
                        ×
                    </button>
                )}
            </div>,
        );
    });

    // ---- Active-tab validity (uses flags from the pass; no rescan) -----
    // If there is no valid active tab (unset on first mount, or the active tab
    // was closed), adopt the first tab discovered during the traversal.
    useEffect(() => {
        if (isControlled) return;
        if (!activeExists) setInternalActiveId(firstTabId);
    }, [isControlled, activeExists, firstTabId]);

    // ---- Notify the caller when the active tab actually changes --------
    const prevActiveRef = useRef<string | null>(resolvedActiveId ?? null);
    useEffect(() => {
        if (prevActiveRef.current !== resolvedActiveId) {
            prevActiveRef.current = resolvedActiveId ?? null;
            onActiveTabChange?.(resolvedActiveId ?? null, data);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedActiveId]);

    return (
        <div
            className={className ? `tabs ${className}` : "tabs"}
            role="tablist"
        >
            {tabElements}
        </div>
    );
}

export default TabBar;
