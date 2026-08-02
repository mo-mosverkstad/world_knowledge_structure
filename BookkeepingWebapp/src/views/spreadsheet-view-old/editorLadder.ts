import { type CellAddress } from "./types";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * The floating editor's size follows a four-rung LADDER. Each rung is only
 * reached when the one before it runs out of room:
 *
 *   1. FITS THE CELL          the box is exactly the cell's size
 *   2. WIDER THAN THE CELL    grow rightwards over the neighbouring columns
 *   3. HIT THE VISIBLE EDGE   stop growing, WRAP, and grow downwards instead
 *   4. HIT THE BOTTOM         stop growing, scroll internally
 *
 * ```
 *   1  +--------+                     2  +--------+---------------+
 *      | short| |                        | a much longer value|  |
 *      +--------+                        +--------+---------------+
 *
 *   3  +--------+-------+ <- edge     4  +--------+-------+ <- edge
 *      | a very long    |               | a very long    |
 *      | value that     |               | value that     |
 *      | wrapped        |               | wrapped and    | <- scrolls
 *      +--------+-------+               +--------+-------+ <- bottom
 * ```
 *
 * WHY THIS IS A PURE FUNCTION
 * ---------------------------
 * The rung decisions are arithmetic over six numbers, and arithmetic is the one
 * part of this feature that can be tested without a layout engine. jsdom reports
 * every measurement as zero, so keeping the ladder separate from the DOM reads is
 * what makes it verifiable at all: the measuring code stays thin enough to check
 * by eye, and every decision it feeds is covered by tests.
 */

/** Measurements taken from the DOM, in px. */
export interface EditorMeasurements {
    /** The cell's own width: the floor, since the box never shrinks below it. */
    cellWidth: number;
    /**
     * The widest the box may become — the distance from its left edge to the
     * right edge of the visible region. Rung 2's ceiling.
     */
    maxWidth: number;
    /** The cell's own height: the floor. */
    minHeight: number;
    /** Room from the box's top edge down to the bottom of the visible region. */
    maxHeight: number;
    /**
     * Width the content wants if it were never wrapped — the longest line. Drives
     * rung 2, and comparing it against `maxWidth` is what detects rung 3.
     */
    naturalWidth: number;
    /** Height the content needs once laid out at the resolved width. */
    contentHeight: number;
}

export interface EditorSize {
    width: number;
    height: number;
    /** True once the box has stopped widening and must wrap instead (rung 3+). */
    wrap: boolean;
    /** True once the box has stopped growing and must scroll instead (rung 4). */
    scroll: boolean;
}

function clamp(value: number, min: number, max: number): number {
    // `max` first, so a max below min cannot produce a value under the floor: a
    // cell taller than the remaining room must still render at cell height.
    return Math.max(min, Math.min(value, max));
}

/**
 * Resolve the ladder. Pure: same numbers in, same numbers out.
 *
 * Note `wrap` is decided by `naturalWidth > maxWidth`, i.e. by whether the
 * content COULD have grown further, not by whether it did. That is what makes
 * rungs 2 and 3 distinct: at rung 2 the box grew and the text is still on one
 * line, at rung 3 the box stopped growing so the text has to fold.
 */
export function resolveEditorSize(m: EditorMeasurements): EditorSize {
    const wrap = m.naturalWidth > m.maxWidth;

    // Rungs 1 and 2: never narrower than the cell, never wider than the room.
    const width = clamp(m.naturalWidth, m.cellWidth, m.maxWidth);

    // Rungs 1 and 3: never shorter than the cell, never taller than the room.
    const height = clamp(m.contentHeight, m.minHeight, m.maxHeight);

    // Rung 4: the content still does not fit the height it was given.
    const scroll = m.contentHeight > height;

    return { width, height, wrap, scroll };
}

// ---------------------------------------------------------------------------
// DOM placement: where the box sits, and how much room it has.
// ---------------------------------------------------------------------------

export interface EditorPlacement {
    /** Offset from the scroll container's CONTENT origin, in px. */
    left: number;
    top: number;
    /** The four bounds the ladder needs. */
    cellWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
}

/** Locate a cell's DOM node by address. `Cell` publishes these attributes. */
export function findCell(
    grid: HTMLElement,
    cell: CellAddress,
): HTMLElement | null {
    return grid.querySelector<HTMLElement>(
        `[data-row="${cell.row}"][data-col="${cell.col}"]`,
    );
}

/**
 * Measure where the editor goes and how much room it has.
 *
 * WHY MEASURE INSTEAD OF COMPUTE
 * ------------------------------
 * Column widths come from `table-layout: auto`, so the BROWSER decides them.
 * There is no width to look up; `getBoundingClientRect` on the real cell is the
 * only honest source.
 *
 * CONTENT COORDINATES, NOT VIEWPORT COORDINATES
 * ---------------------------------------------
 * `left`/`top` are offsets from the scroll container's content origin, so the box
 * is positioned inside the scrolled content and therefore tracks its cell with no
 * scroll handler at all — the same reason `position: sticky` needs no JavaScript.
 * The container also clips its own absolutely positioned descendants, so panning
 * away reveals progressively less of the box and eventually none: "as long as one
 * character fits, show it" needs no threshold and no code.
 *
 * The SIZE bounds do depend on the scroll offset, which is why a scroll listener
 * exists while editing even though the position does not need one.
 *
 * `maxWidth` is clamped against the visible right edge but never the left.
 * Clamping both would re-anchor the box as you pan, so the text would rewrap
 * mid-scroll — instability. Clamping only the right means panning right merely
 * clips the box's left side and the wrap survives.
 */
export function measurePlacement(
    grid: HTMLElement,
    cell: CellAddress,
): EditorPlacement | null {
    const target = findCell(grid, cell);
    if (!target) return null;

    const gridRect = grid.getBoundingClientRect();
    const cellRect = target.getBoundingClientRect();

    // Rect deltas are already relative to the current scroll position, so adding
    // the scroll offset converts them into content coordinates. Subtracting
    // `clientLeft`/`clientTop` removes the container's border.
    const left =
        cellRect.left - gridRect.left + grid.scrollLeft - grid.clientLeft;
    const top = cellRect.top - gridRect.top + grid.scrollTop - grid.clientTop;

    // The visible region, in the same coordinate space.
    const visibleRight = grid.scrollLeft + grid.clientWidth;
    const visibleBottom = grid.scrollTop + grid.clientHeight;

    return {
        left,
        top,
        cellWidth: cellRect.width,
        // Rung 2's ceiling: all the room to the right, not just this cell's.
        // Never below the cell's own width, so a cell scrolled partly off the
        // right edge still gets an editor at least as wide as itself.
        maxWidth: Math.max(cellRect.width, visibleRight - left),
        minHeight: cellRect.height,
        maxHeight: Math.max(cellRect.height, visibleBottom - top),
    };
}
