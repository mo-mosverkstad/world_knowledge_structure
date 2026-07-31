import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `useRevealActiveTab` has exactly one job: when the active tab changes, make
 * sure it is visible inside the horizontally scrolled tab strip.
 *
 * NOT CALLED — OBSERVED
 * ---------------------
 * Nothing ever asks this hook to scroll. It watches `activeId` and reacts to a
 * *change of value*, which is what keeps revealing decoupled from selecting:
 *
 *     coupled                       decoupled (this hook)
 *     select(id) {                  useLayoutEffect(() => {
 *         setState(id);                 reveal();
 *         reveal();   ← the setter  }, [activeId]);
 *     }              knows about
 *                    scrolling
 *
 * Both produce the same behavior for a click, but only the observing form also
 * fires when the host changes the active tab entirely on its own (a keyboard
 * shortcut, a route change, an undo) — because in that case there is no call
 * site to attach a `reveal()` to. No caller, and no other hook, needs to know
 * this hook exists.
 *
 * SINGLE TRIGGER
 * --------------
 * `activeId` is the only dependency, deliberately. Deriving extra triggers
 * ("the active tab moved because an earlier tab was closed", "the container was
 * resized") would drag reorder state, drag state and resize observers in here
 * and give the hook several unrelated reasons to change. It would also make the
 * component re-assert scroll position on mutations the user did not initiate,
 * which is what makes such implementations feel like they are fighting the
 * pointer. Revealing answers one question only: *the active tab just changed —
 * can it be seen?*
 *
 * WHY NOT `scrollIntoView()`
 * --------------------------
 * `Element.scrollIntoView()` walks up and scrolls *every* scrollable ancestor,
 * so selecting a tab can jump the whole page when the strip sits inside another
 * scroll container. Writing `container.scrollLeft` touches exactly one element.
 */

export interface UseRevealActiveTabOptions {
    /** The scroll viewport — the element with `overflow-x`. */
    containerRef: RefObject<HTMLElement | null>;
    /** The active tab id. THE trigger: a change of this value reveals. */
    activeId: string | null;
    /** When false the hook does nothing. Default true. */
    enabled?: boolean;
    /** Scroll animation. Default "instant"; downgraded under reduced motion. */
    behavior?: ScrollBehavior;
    /** Breathing room in px between the tab and the viewport edge. Default 8. */
    margin?: number;
}

/** Selector for the active tab. `aria-selected` is set by `Tab` for a11y. */
const ACTIVE_TAB_SELECTOR = '[role="tab"][aria-selected="true"]';

/**
 * Scroll `container` the minimum distance needed to bring `target` fully into
 * view horizontally. Exported for testing; not part of the public API.
 *
 * Works in one coordinate space: pixels from the container's left content edge.
 *
 *     0                                                    scrollWidth
 *     ├──────────────────────────────────────────────────────────────┤
 *     │ t1 │ t2 │ t3 │ t4 │ t5 │ t6 │ t7 │ t8 │ t9 │t10 │t11 │t12 │
 *              ╞═══════════ clientWidth ═══════════╡
 *              ▲                                   ▲
 *        scrollLeft              scrollLeft + clientWidth
 *
 * Four cases:
 *   W  target is wider than the viewport  → align its leading edge (see below)
 *   A  target starts before the viewport  → scroll left  (nudge by the deficit)
 *   B  target ends after the viewport     → scroll right (nudge by the excess)
 *   C  already fully visible              → do nothing
 *
 * Case C makes the operation minimal and idempotent: re-revealing a visible tab
 * never moves the strip, so this can run on every active-tab change without
 * yanking the view around.
 *
 * Case W is what keeps that idempotence unconditional. A tab wider than the
 * viewport can never satisfy case C, and cases A and B then both apply and each
 * overshoots past the other, so the strip oscillates between two offsets for as
 * long as the tab stays active. Checking the width first replaces "make it fully
 * visible", which is unachievable, with "show as much of it as possible from the
 * start", which is reachable and stable.
 *
 * Measured with `getBoundingClientRect` rather than `offsetLeft` because
 * `offsetLeft` is relative to the nearest *positioned* ancestor and would break
 * silently depending on the container's `position`. Rect deltas are already
 * relative to the current scroll position, and subtracting `clientLeft` removes
 * the container's border so the comparison against `clientWidth` is exact.
 */
export function revealHorizontally(
    container: HTMLElement,
    target: HTMLElement,
    margin = 8,
    behavior: ScrollBehavior = "instant",
): void {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    // Target position relative to the container's visible content box.
    const start = targetRect.left - containerRect.left - container.clientLeft;
    const end = start + targetRect.width;
    const viewportWidth = container.clientWidth;

    let delta = 0;
    if (targetRect.width > viewportWidth) {
        // CASE W — the tab cannot fit, so "fully visible" is unreachable and
        // cases A and B would fight each other forever. Align the leading edge
        // and accept that the trailing end stays clipped. Checked FIRST, because
        // an over-wide tab also satisfies A or B.
        if (start === 0) return;
        delta = start;
    } else if (start < 0) {
        // CASE A — clipped on the left.
        delta = start - margin;
    } else if (end > viewportWidth) {
        // CASE B — clipped on the right.
        delta = end - viewportWidth + margin;
    } else {
        // CASE C — fully visible; leave the strip exactly where it is.
        return;
    }

    const target_ = container.scrollLeft + delta;
    // Clamp so a margin near either end cannot request an out-of-range offset.
    const max = container.scrollWidth - viewportWidth;
    const next = Math.max(0, Math.min(target_, max));
    if (next === container.scrollLeft) return;

    // `scrollTo` accepts a behavior per call, which keeps the animation choice
    // in props rather than in the stylesheet.
    container.scrollTo({ left: next, behavior });
}

/** True when the user asked for reduced motion. */
function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export function useRevealActiveTab(options: UseRevealActiveTabOptions): void {
    const {
        containerRef,
        activeId,
        enabled = true,
        behavior = "instant",
        margin = 8,
    } = options;

    // Read through a ref so changing `behavior` or `margin` alone cannot
    // retrigger a scroll — only a genuine active-tab change may.
    const settings = useRef({ behavior, margin, enabled });
    settings.current = { behavior, margin, enabled };

    // A LAYOUT effect, not a passive one: it runs after React commits the DOM
    // but *before* the browser paints, so the corrected scroll position lands in
    // the same frame. With `useEffect` the user would see one painted frame at
    // the old offset and then a snap — most visible on first mount, when the
    // initially active tab may be far down the strip.
    useLayoutEffect(() => {
        const settings_ = settings.current;
        if (!settings_.enabled) return;
        if (activeId === null) return;

        const container = containerRef.current;
        if (!container) return;

        const target = container.querySelector<HTMLElement>(
            ACTIVE_TAB_SELECTOR,
        );
        if (!target) return;

        const behavior_ =
            settings_.behavior === "smooth" && prefersReducedMotion()
                ? "instant"
                : settings_.behavior;

        revealHorizontally(container, target, settings_.margin, behavior_);
        // Intentionally ONE dependency. See the note on SINGLE TRIGGER above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);
}
