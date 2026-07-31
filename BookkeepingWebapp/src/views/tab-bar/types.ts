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

/**
 * Why the component is asking for a new active tab.
 *
 *   - `"user-select"` — the user activated a tab (click or Enter/Space).
 *   - `"fallback"`    — the previously active tab is no longer yielded by
 *                       `forEachTab` (it was closed or removed), so the
 *                       component proposes a replacement: the first tab, or
 *                       `null` when no tabs remain.
 *   - `"initial"`     — nothing has been active yet and no initial value was
 *                       stated, so the component proposes the first tab. Fires
 *                       at most once, and only in uncontrolled mode (a
 *                       controlled host states its own initial value).
 *
 * The distinction matters because only the first is a deliberate user action.
 * A host that records, mirrors or animates selection changes usually wants to
 * treat the three differently — in particular, `"initial"` is not a transition
 * away from anything, so it is rarely an undo step.
 */
export type ActiveTabSelectReason = "user-select" | "fallback" | "initial";

/**
 * How the tab bar reveals the active tab when it scrolls out of view.
 *
 * Exposed as options rather than hard-coded because this is a generic component:
 * an editor integration usually wants the reveal to be imperceptible, while a
 * presentation-style UI may prefer to animate it.
 */
export interface RevealActiveTabOptions {
    /**
     * Scroll animation. Default `"instant"` — a generic component should feel
     * immediate, not laggy. Pass `"smooth"` to animate; that is automatically
     * downgraded to instant when the user has `prefers-reduced-motion: reduce`.
     */
    behavior?: ScrollBehavior;
    /**
     * Pixels of breathing room left between the revealed tab and the viewport
     * edge, so the tab does not sit flush against the clip. Default 8.
     */
    margin?: number;
}

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
     * tab, or programmatically). Purely a NOTIFICATION, after the fact —
     * to influence or own the active tab, use the active-tab port below.
     *
     * `index` is the 0-based position of the active tab in the traversal order
     * produced by `forEachTab`, or `null` when nothing is active. It is derived
     * for free during the single render pass. Treat it as read-only: an index is
     * not a stable address, since it shifts under close and reorder. Address
     * tabs by `id`.
     */
    onActiveTabChange?: (
        tabId: string | null,
        index: number | null,
        data: TData,
    ) => void;

    // ---- CUSTOMIZATION -------------------------------------------------
    /** Show a delete (×) affordance and allow tabs to be closed. Default: false. */
    closable?: boolean;
    /** Allow tabs to be reordered via drag & drop. Default: false. */
    reorderable?: boolean;

    // ---- SIZING & OVERFLOW ---------------------------------------------
    /**
     * Maximum width of the tab strip. A `number` is taken as pixels (matching
     * React's `style` convention); a `string` is passed through to CSS verbatim,
     * so relative and computed units all work:
     *
     *   maxWidth={400}                        →  max-width: 400px
     *   maxWidth="50%"                        →  max-width: 50%
     *   maxWidth="clamp(200px, 40vw, 600px)"  →  as written
     *
     * Tabs stack up to that width; beyond it the strip scrolls horizontally.
     * Note that a percentage resolves against the containing block, so the
     * parent needs a definite width for `"50%"` to mean what you expect.
     */
    maxWidth?: number | string;
    /**
     * Keep the active tab visible: when the active tab changes and it lies
     * outside the scrolled viewport, the strip scrolls just far enough to
     * reveal it.
     *
     * This happens for *any* active-tab change, including one driven entirely
     * from outside the component (a host writing its own state). Callers never
     * request a scroll — revealing is a consequence of the active tab changing,
     * observed internally, so nothing on the caller's side needs to know that
     * scrolling exists.
     *
     * `true` (the default) uses the defaults of {@link RevealActiveTabOptions};
     * `false` disables revealing; an object customises it.
     */
    revealActiveTab?: boolean | RevealActiveTabOptions;

    // ---- ACTIVE-TAB PORT ------------------------------------------------
    // `activeTabId` and `onActiveTabSelect` are the READ and WRITE halves of
    // one port, exactly as `value` / `onChange` are on an `<input>`. Supply
    // both to own the active tab externally; supply neither to let the
    // component keep it internally.
    //
    // The point of the write half is that the active tab is *caller policy*,
    // not something intrinsic to being a tab bar. Once the host owns it, the
    // host can also change it — from a keyboard shortcut outside the strip,
    // from a URL, from a restored session, from a command stack — and the tab
    // bar simply renders whatever it is told.
    /**
     * Controlled active tab id. When this prop is *present* the component
     * stores nothing and defers entirely to the caller:
     *
     *   - `"someId"` — that tab is active.
     *   - `null`     — nothing is active. (An explicit, legal state.)
     *   - omitted    — uncontrolled; the component tracks the active tab
     *                  itself, seeded by `defaultActiveTabId`.
     *
     * Note that `undefined` is not "nothing active" — it means "you own it".
     * Pass `null` for the empty selection.
     */
    activeTabId?: string | null;
    /**
     * REQUEST for the active tab to become `tabId`. The write half of the
     * active-tab port.
     *
     * Called before the change is applied, and — unlike `onActiveTabChange` —
     * in *both* controlled and uncontrolled mode, so a host can observe
     * selection intent without taking ownership.
     *
     * In controlled mode this is the only way the component can ask for a
     * change; if the host ignores it, nothing happens. That is intentional:
     * the host may redirect the request, defer it, or refuse it (an unsaved
     * -changes guard, for instance).
     *
     * See {@link ActiveTabSelectReason} for why the request is being made. The
     * `"fallback"` case is the important one for controlled hosts: it is how
     * the component reports "the tab you have marked active no longer exists,
     * here is a replacement". Note that a controlled `null` is a resting state,
     * not a dead id — holding it produces no requests at all.
     */
    onActiveTabSelect?: (
        tabId: string | null,
        data: TData,
        reason: ActiveTabSelectReason,
    ) => void;
    /**
     * Initial active tab id for the uncontrolled case. When omitted, the first
     * tab yielded by `forEachTab` becomes active (resolved during the first
     * traversal — no separate accessor needed, and reported as an
     * `onActiveTabSelect(..., "initial")`). Ignored when `activeTabId` is
     * present.
     *
     * Passing `null` explicitly means "start with nothing active" and suppresses
     * that seeding, exactly as `defaultValue=""` leaves an `<input>` empty.
     */
    defaultActiveTabId?: string | null;

    /** Optional extra class name for the outer container. */
    className?: string;
}
