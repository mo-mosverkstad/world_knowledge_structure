import { type ReactNode } from "react";

/**
 * Public data contract for the tab bar.
 *
 * These types are the stable surface consumers program against; they live in
 * their own module so the coordinator implementation (`TabBar.tsx`) and the
 * front door (`index.tsx`) can share them without pulling in behavior.
 */

/**
 * The minimal, presentation-facing description of a single tab.
 *
 * This is the *only* shape the component understands. The caller yields these
 * out of its arbitrary business data (`TData`) via the `forEachTab` prop.
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
