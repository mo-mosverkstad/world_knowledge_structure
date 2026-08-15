import { useCallback, useEffect, useRef, type RefObject } from "react";
import { autoScrollVelocity } from "./autoScrollVelocity";

export interface UseDragAutoScrollOptions {
    /** The scroll container. */
    scrollRef: RefObject<HTMLElement | null>;
    /**
     * Whether a drag is in progress. A REF, not a boolean: the gesture must not
     * re-render anything, so the caller keeps this out of state and the loop
     * reads it fresh each frame.
     */
    active: RefObject<boolean>;
    /** The cell now under the pointer, after a scroll step moved the grid. */
    onCellUnderPointer: (row: number, col: number) => void;
}

/**
 * Which cell sits at a client point.
 *
 * ---------------------------------------------------------------------------
 * Geometry belongs to the table layer, published as
 * an interface (`useTableGeometry`) rather than recovered from the DOM. Two
 * things are wrong with it until that exists:
 *
 *   - it reads `table-view`'s markup (`thead`, `.row__header`) from
 *     `spreadsheet-view`, so a change there breaks this silently;
 *   - it hit-tests, so a virtualized row that is scrolled to but not yet
 *     rendered has no element to find, and the drag stops extending.
 *
 * With geometry available, both go away: the row is `floor(y / rowHeight)`
 * against `scrollTop`, needing no DOM at all.
 * ---------------------------------------------------------------------------
 */
function cellFromPoint(
    container: HTMLElement,
    x: number,
    y: number,
): { row: number; col: number } | null {
    const rect = container.getBoundingClientRect();

    /*
     * The pointer is OUTSIDE the container — that is the whole premise — so
     * probing at its real position hit-tests whatever sits behind the grid.
     * Clamping brings the probe back inside.
     *
     * Clamping to the container's own edges is not enough: the header row and the
     * gutter are `position: sticky`, so they cover the top and left edges. A probe
     * there lands on a <th>, which carries no `data-row`, and the drag silently
     * fails to extend upwards. The data area is the region that excludes them.
     */
    const header = container.querySelector("thead");
    const headerBottom = header
        ? header.getBoundingClientRect().bottom
        : rect.top;
    const gutter = container.querySelector<HTMLElement>(".row__header");
    const gutterRight = gutter
        ? gutter.getBoundingClientRect().right
        : rect.left;

    // +/-1 so the probe is inside the box rather than exactly on its boundary,
    // where hit-testing may return the neighbour.
    const px = Math.min(
        Math.max(x, Math.max(rect.left, gutterRight) + 1),
        rect.right - 1,
    );
    const py = Math.min(
        Math.max(y, Math.max(rect.top, headerBottom) + 1),
        rect.bottom - 1,
    );

    // Absent outside a real browser (jsdom has no layout, so no hit-testing).
    if (typeof document.elementFromPoint !== "function") return null;

    const hit = document.elementFromPoint(px, py);
    const cell = hit?.closest<HTMLElement>("[data-row][data-col]");
    if (!cell || !container.contains(cell)) return null;

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    return Number.isFinite(row) && Number.isFinite(col) ? { row, col } : null;
}

/**
 * Scrolls the viewport when a drag reaches its edge, the way a spreadsheet does.
 *
 * Three things are needed and none of them are a cell event. `mouseenter` reports
 * which cell was entered, so it says nothing once the pointer is past the last
 * one — hence pointer COORDINATES, taken at the window. A pointer held still
 * beyond the edge fires no events at all, yet must keep scrolling — hence a
 * CLOCK. And after each step a different cell is under the unmoved pointer, which
 * the selection has to follow — hence a point-to-cell lookup.
 *
 * Nothing here renders: coordinates and the frame handle live in refs, and the
 * only output is `onCellUnderPointer`.
 */
export function useDragAutoScroll({
    scrollRef,
    active,
    onCellUnderPointer,
}: UseDragAutoScrollOptions) {
    const pointer = useRef({ x: 0, y: 0 });
    const frame = useRef<number | null>(null);
    const lastTime = useRef(0);
    // Sub-pixel scroll carried between frames; see `step`.
    const residue = useRef({ x: 0, y: 0 });

    // Read through a ref so the loop never captures a stale callback and the
    // effect below does not need to re-subscribe when the caller re-renders.
    const notify = useRef(onCellUnderPointer);
    notify.current = onCellUnderPointer;

    const stop = useCallback(() => {
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
            frame.current = null;
        }
        // A new gesture starts from a whole pixel, not a leftover fraction.
        residue.current = { x: 0, y: 0 };
    }, []);

    const step = useCallback(
        (now: number) => {
            frame.current = null;

            const container = scrollRef.current;
            if (!container || !active.current) return;

            /*
             * Seconds, so speed is px/s and does not depend on refresh rate.
             * Bounded at both ends: a backgrounded tab resumes with a huge gap,
             * which would teleport the view, and a timestamp from a clock other
             * than the one that seeded `lastTime` can read as negative, which
             * would scroll BACKWARDS.
             */
            const dt = Math.max(
                0,
                Math.min((now - lastTime.current) / 1000, 0.05),
            );
            lastTime.current = now;

            const { vx, vy } = autoScrollVelocity(
                container.getBoundingClientRect(),
                pointer.current,
            );
            // Pointer came back inside: nothing to do until it leaves again.
            if (vx === 0 && vy === 0) return;

            const beforeLeft = container.scrollLeft;
            const beforeTop = container.scrollTop;
            /*
             * `scrollBy` is missing in jsdom; assigning is equivalent and always
             * present, and the browser clamps both to the scrollable range.
             *
             * The remainder is carried between frames because scroll offsets can
             * be integers: at the gentlest speed a frame's movement is a fraction
             * of a pixel, which would round to zero, look like "already at the
             * end" below, and stall the scroll exactly at the threshold where it
             * is meant to creep.
             */
            const wantLeft = beforeLeft + vx * dt + residue.current.x;
            const wantTop = beforeTop + vy * dt + residue.current.y;
            container.scrollLeft = wantLeft;
            container.scrollTop = wantTop;

            /*
             * Only sub-pixel loss is carried. A larger discrepancy means the
             * browser CLAMPED — the end of the range — and carrying that would
             * grow without bound and keep the loop alive forever.
             */
            const lostX = wantLeft - container.scrollLeft;
            const lostY = wantTop - container.scrollTop;
            residue.current = {
                x: Math.abs(lostX) < 1 ? lostX : 0,
                y: Math.abs(lostY) < 1 ? lostY : 0,
            };

            /*
             * Already at the end: nothing moved and nothing is pending. Without
             * this the loop would spin every frame for the rest of the drag,
             * hit-testing for a cell that cannot change.
             */
            if (
                container.scrollLeft === beforeLeft &&
                container.scrollTop === beforeTop &&
                residue.current.x === 0 &&
                residue.current.y === 0
            ) {
                return;
            }

            const cell = cellFromPoint(
                container,
                pointer.current.x,
                pointer.current.y,
            );
            if (cell) notify.current(cell.row, cell.col);

            frame.current = requestAnimationFrame(step);
        },
        [scrollRef, active],
    );

    const start = useCallback(() => {
        if (frame.current !== null) return;
        lastTime.current = performance.now();
        frame.current = requestAnimationFrame(step);
    }, [step]);

    useEffect(() => {
        /*
         * On the window, not the container: the pointer is out of bounds by
         * definition, which is the same reason the drag's `mouseup` is caught
         * there. The listener stays attached for the component's life and guards
         * on `active` instead, because a ref cannot be an effect dependency —
         * making it one would mean state, and state would mean re-rendering on
         * every drag.
         */
        const onMove = (event: MouseEvent) => {
            if (!active.current) return;
            pointer.current = { x: event.clientX, y: event.clientY };

            const container = scrollRef.current;
            if (!container) return;
            const { vx, vy } = autoScrollVelocity(
                container.getBoundingClientRect(),
                pointer.current,
            );
            if (vx !== 0 || vy !== 0) start();
            else stop();
        };

        window.addEventListener("mousemove", onMove);
        return () => {
            window.removeEventListener("mousemove", onMove);
            stop();
        };
    }, [scrollRef, active, start, stop]);

    // The caller ends the drag on mouseup/blur and must stop the loop with it;
    // an orphaned loop would keep scrolling while nothing is being dragged.
    return stop;
}
