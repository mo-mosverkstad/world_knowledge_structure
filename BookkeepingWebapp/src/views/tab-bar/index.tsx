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
 *   2. fetch callbacks — how to *read* tabs out of that data (`getTabs`).
 *   3. mutate callbacks— how to *manipulate* that data when the user closes or
 *                        reorders a tab (`onTabClose`, `onTabReorder`).
 *   4. behavior hooks  — what should *happen* on interactions (`onTabClick`,
 *                        `onActiveTabChange`). These are defined by the caller,
 *                        never by the component.
 *
 * Because every read/write of the business data goes through a callback, the
 * business data structure (`TData`) stays fully decoupled from the component.
 */

/**
 * The minimal, presentation-facing description of a single tab.
 *
 * This is the *only* shape the component understands. The caller is
 * responsible for projecting its arbitrary business data (`TData`) into a list
 * of these descriptors via {@link TabBarProps.getTabs}.
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

export interface TabBarProps<TData> {
    // ---- DATA PORT -----------------------------------------------------
    /**
     * The business data structure. Opaque to the component; only the callbacks
     * below give it meaning.
     */
    data: TData;

    // ---- FETCH CALLBACKS (read the data port) --------------------------
    /**
     * Project the business `data` into the list of tabs to display.
     * Called on every render, so it should be cheap / pure.
     */
    getTabs: (data: TData) => TabDescriptor[];

    // ---- MUTATE CALLBACKS (operate on the data port) -------------------
    /**
     * Requested when the user closes a tab (only reachable when closing is
     * enabled). The caller performs the actual mutation on its own data
     * structure and passes back updated `data` on the next render.
     */
    onTabClose?: (tabId: string, data: TData) => void;
    /**
     * Requested when the user drags a tab to a new position (only reachable
     * when `reorderable` is true). Indices refer to positions in the array
     * returned by `getTabs`.
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
     * Initial active tab id for the uncontrolled case. Defaults to the first
     * tab returned by `getTabs`.
     */
    defaultActiveTabId?: string;

    /** Optional extra class name for the outer container. */
    className?: string;
}

export function TabBar<TData>(props: TabBarProps<TData>) {
    const {
        data,
        getTabs,
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

    const tabs = getTabs(data);
    const isControlled = activeTabId !== undefined;

    // ---- Encapsulated tab-bar concern: remember the active tab ---------
    // In uncontrolled mode we track the active tab ourselves. This is core to
    // "being a tab bar" and is therefore owned by the component, not delegated.
    const [internalActiveId, setInternalActiveId] = useState<string | null>(
        () => defaultActiveTabId ?? tabs[0]?.id ?? null,
    );

    const resolvedActiveId = isControlled ? activeTabId : internalActiveId;

    // Keep the active tab valid as the data port changes underneath us. If the
    // active tab disappears (e.g. it was closed), fall back to a neighbour.
    // This is an intrinsic tab-bar responsibility, so it lives here.
    const prevActiveRef = useRef<string | null>(resolvedActiveId ?? null);
    useEffect(() => {
        if (isControlled) return;
        const stillExists = tabs.some((t) => t.id === internalActiveId);
        if (!stillExists) {
            const fallback = tabs[0]?.id ?? null;
            setInternalActiveId(fallback);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs, internalActiveId, isControlled]);

    // Notify the caller when the active tab actually changes.
    useEffect(() => {
        if (prevActiveRef.current !== resolvedActiveId) {
            prevActiveRef.current = resolvedActiveId ?? null;
            onActiveTabChange?.(resolvedActiveId ?? null, data);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedActiveId]);

    const activate = useCallback(
        (id: string) => {
            if (!isControlled) setInternalActiveId(id);
        },
        [isControlled],
    );

    const handleTabClick = useCallback(
        (tab: TabDescriptor) => {
            console.log("Tab:", tab)
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

    // ---- Drag & drop reordering (opt-in via `reorderable`) -------------
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

    return (
        <div
            className={className ? `tabs ${className}` : "tabs"}
            role="tablist"
        >
            {tabs.map((tab, index) => {
                const isActive = tab.id === resolvedActiveId;
                const tabClosable =
                    (tab.closable ?? closable) && onTabClose !== undefined;
                const classes = ["tab"];
                if (isActive) classes.push("tab--active");
                if (tab.disabled) classes.push("tab--disabled");
                if (dragOverIndex === index && dragIndex !== index)
                    classes.push("tab--drop-target");

                return (
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
                            reorderable
                                ? () => handleDragStart(index)
                                : undefined
                        }
                        onDragOver={
                            reorderable
                                ? (e) => handleDragOver(e, index)
                                : undefined
                        }
                        onDrop={
                            reorderable ? (e) => handleDrop(e, index) : undefined
                        }
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
                    </div>
                );
            })}
        </div>
    );
}

export default TabBar;
