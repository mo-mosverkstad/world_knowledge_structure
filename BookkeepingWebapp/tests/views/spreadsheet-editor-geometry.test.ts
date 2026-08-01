// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    measurePlacement,
    resolveEditorSize,
    type EditorMeasurements,
} from "../../src/views/spreadsheet-view/editorLadder";

/**
 * Geometry tests for the floating editor.
 *
 * Split in two, because the two halves are testable to different degrees:
 *
 *   - `resolveEditorSize` is PURE arithmetic, so the four-rung ladder can be
 *     verified exactly.
 *   - `measurePlacement` reads the DOM, and jsdom has no layout engine (every
 *     rect is zero), so its inputs are faked around a real DOM structure — the
 *     same technique the tab bar's scroll tests use. The coordinate conversion and
 *     the clamping are exercised; real browser layout is not, and cannot be here.
 */

// ---------------------------------------------------------------------------
// The ladder: pure, so exactly verifiable.
// ---------------------------------------------------------------------------

/** A cell 100 wide with 400 of room to its right, 24 tall with 200 below. */
const base: EditorMeasurements = {
    cellWidth: 100,
    maxWidth: 400,
    minHeight: 24,
    maxHeight: 200,
    naturalWidth: 100,
    contentHeight: 24,
};

describe("ladder rung 1 — content fits the cell", () => {
    it("is exactly the cell's size", () => {
        const s = resolveEditorSize(base);
        expect(s.width).toBe(100);
        expect(s.height).toBe(24);
        expect(s.wrap).toBe(false);
        expect(s.scroll).toBe(false);
    });

    it("never shrinks below the cell, however short the content", () => {
        const s = resolveEditorSize({
            ...base,
            naturalWidth: 10,
            contentHeight: 5,
        });
        expect(s.width).toBe(100);
        expect(s.height).toBe(24);
    });
});

describe("ladder rung 2 — grow rightwards over neighbouring columns", () => {
    it("widens to fit the content instead of wrapping", () => {
        // THE BEHAVIOUR THIS LADDER WAS BUILT FOR: overflow expands the box past
        // its own cell first, rather than immediately folding inside it.
        const s = resolveEditorSize({ ...base, naturalWidth: 250 });
        expect(s.width).toBe(250);
        expect(s.wrap).toBe(false);
        expect(s.scroll).toBe(false);
    });

    it("grows the width monotonically with the content", () => {
        const widths = [120, 200, 300, 399].map(
            (naturalWidth) =>
                resolveEditorSize({ ...base, naturalWidth }).width,
        );
        expect(widths).toEqual([120, 200, 300, 399]);
    });

    it("stays on one line right up to the ceiling", () => {
        const s = resolveEditorSize({ ...base, naturalWidth: 400 });
        expect(s.width).toBe(400);
        expect(s.wrap).toBe(false);
    });
});

describe("ladder rung 3 — hit the visible edge, wrap and grow down", () => {
    it("stops widening at the ceiling and switches to wrapping", () => {
        const s = resolveEditorSize({
            ...base,
            naturalWidth: 900,
            contentHeight: 72,
        });
        expect(s.width).toBe(400);
        expect(s.wrap).toBe(true);
        expect(s.height).toBe(72);
        expect(s.scroll).toBe(false);
    });

    it("decides wrapping from whether growth was CAPPED, not from height", () => {
        // The distinction between rungs 2 and 3: at rung 2 the box grew and the
        // text is still one line; at rung 3 growth stopped so the text must fold.
        expect(resolveEditorSize({ ...base, naturalWidth: 401 }).wrap).toBe(true);
        expect(resolveEditorSize({ ...base, naturalWidth: 400 }).wrap).toBe(false);
    });

    it("grows downward as the wrapped content gets taller", () => {
        const heights = [24, 48, 96, 199].map(
            (contentHeight) =>
                resolveEditorSize({
                    ...base,
                    naturalWidth: 900,
                    contentHeight,
                }).height,
        );
        expect(heights).toEqual([24, 48, 96, 199]);
    });
});

describe("ladder rung 4 — hit the bottom, scroll internally", () => {
    it("caps the height and asks for scrolling", () => {
        const s = resolveEditorSize({
            ...base,
            naturalWidth: 900,
            contentHeight: 500,
        });
        expect(s.height).toBe(200);
        expect(s.scroll).toBe(true);
        expect(s.wrap).toBe(true);
    });

    it("does not scroll while the content still fits", () => {
        expect(
            resolveEditorSize({ ...base, naturalWidth: 900, contentHeight: 200 })
                .scroll,
        ).toBe(false);
        expect(
            resolveEditorSize({ ...base, naturalWidth: 900, contentHeight: 201 })
                .scroll,
        ).toBe(true);
    });

    it("still renders at cell height when there is no room at all", () => {
        // A cell flush against the bottom edge: the floor must win over the
        // ceiling, or the box would be invisible.
        const s = resolveEditorSize({
            ...base,
            maxHeight: 4,
            contentHeight: 100,
        });
        expect(s.height).toBe(24);
        expect(s.scroll).toBe(true);
    });
});

describe("the whole ladder in sequence", () => {
    it("climbs one rung at a time as the content grows", () => {
        const steps = [
            { naturalWidth: 50, contentHeight: 24 },
            { naturalWidth: 250, contentHeight: 24 },
            { naturalWidth: 900, contentHeight: 72 },
            { naturalWidth: 900, contentHeight: 500 },
        ].map((m) => {
            const s = resolveEditorSize({ ...base, ...m });
            return `${s.width}x${s.height} wrap=${s.wrap} scroll=${s.scroll}`;
        });

        expect(steps).toEqual([
            "100x24 wrap=false scroll=false", // rung 1: fits the cell
            "250x24 wrap=false scroll=false", // rung 2: grew rightwards
            "400x72 wrap=true scroll=false", // rung 3: capped, wrapped, grew down
            "400x200 wrap=true scroll=true", // rung 4: capped, scrolls
        ]);
    });
});

// ---------------------------------------------------------------------------
// Placement: DOM reads, with faked geometry.
// ---------------------------------------------------------------------------

const VIEW_W = 300;
const VIEW_H = 200;

interface FakeOpts {
    scrollLeft?: number;
    scrollTop?: number;
    /** The cell's position in CONTENT coordinates. */
    cellLeft: number;
    cellTop: number;
    cellWidth: number;
    cellHeight: number;
}

function fakeGrid(o: FakeOpts) {
    const {
        scrollLeft = 0,
        scrollTop = 0,
        cellLeft,
        cellTop,
        cellWidth,
        cellHeight,
    } = o;

    const grid = document.createElement("div");
    for (const [prop, value] of [
        ["clientWidth", VIEW_W],
        ["clientHeight", VIEW_H],
        ["clientLeft", 0],
        ["clientTop", 0],
        ["scrollLeft", scrollLeft],
        ["scrollTop", scrollTop],
    ] as const) {
        Object.defineProperty(grid, prop, { value, configurable: true });
    }
    grid.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: VIEW_W, height: VIEW_H }) as DOMRect;

    const cell = document.createElement("td");
    cell.setAttribute("data-row", "3");
    cell.setAttribute("data-col", "2");
    // Viewport-relative rect = content position minus the scroll offset.
    cell.getBoundingClientRect = () =>
        ({
            left: cellLeft - scrollLeft,
            top: cellTop - scrollTop,
            width: cellWidth,
            height: cellHeight,
        }) as DOMRect;
    grid.appendChild(cell);

    return grid;
}

const at = { row: 3, col: 2 };

describe("placement — content coordinates", () => {
    it("converts a cell rect into content coordinates", () => {
        const p = measurePlacement(
            fakeGrid({
                scrollLeft: 50,
                scrollTop: 30,
                cellLeft: 120,
                cellTop: 80,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.left).toBe(120);
        expect(p.top).toBe(80);
    });

    it("is unaffected by scrolling, since position is content-relative", () => {
        // All three describe the SAME cell at content position (120, 80); only the
        // scroll offset differs, so the viewport rect differs too. Asserting the
        // absolute value is what makes this fail if the scroll offset is dropped
        // and viewport coordinates are returned instead.
        for (const scrollLeft of [0, 90, 200]) {
            const p = measurePlacement(
                fakeGrid({
                    scrollLeft,
                    scrollTop: scrollLeft / 2,
                    cellLeft: 120,
                    cellTop: 80,
                    cellWidth: 100,
                    cellHeight: 24,
                }),
                at,
            )!;
            expect(p.left).toBe(120);
            expect(p.top).toBe(80);
        }
    });

    it("returns null when the cell is not in the DOM", () => {
        const grid = fakeGrid({
            cellLeft: 0,
            cellTop: 0,
            cellWidth: 10,
            cellHeight: 10,
        });
        expect(measurePlacement(grid, { row: 99, col: 99 })).toBeNull();
    });
});

describe("placement — how much room the ladder is given", () => {
    it("offers all the room to the right, not just the cell's own width", () => {
        // This is what enables rung 2. The old behaviour clamped to the cell, so
        // the box could never overlay a neighbouring column.
        const p = measurePlacement(
            fakeGrid({
                cellLeft: 20,
                cellTop: 0,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.cellWidth).toBe(100);
        // 300-wide viewport, cell starting at 20 -> 280 of room.
        expect(p.maxWidth).toBe(280);
        expect(p.maxWidth).toBeGreaterThan(p.cellWidth);
    });

    it("shrinks the ceiling as the cell approaches the right edge", () => {
        const p = measurePlacement(
            fakeGrid({
                cellLeft: 250,
                cellTop: 0,
                cellWidth: 40,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.maxWidth).toBe(50);
    });

    it("never offers less room than the cell's own width", () => {
        // A cell hanging past the right edge: the box must still cover its cell.
        const p = measurePlacement(
            fakeGrid({
                cellLeft: 250,
                cellTop: 0,
                cellWidth: 200,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.maxWidth).toBe(200);
    });

    it("is NOT clamped on the left, so panning past a cell does not rewrap it", () => {
        // Deliberate asymmetry. Clamping the left would re-anchor the box and the
        // text would rewrap while scrolling, which reads as instability; the
        // container clips the box instead.
        const p = measurePlacement(
            fakeGrid({
                scrollLeft: 200,
                cellLeft: 100,
                cellTop: 0,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.left).toBe(100);
        expect(p.left).toBeLessThan(200);
    });

    it("offers all the room down to the bottom of the visible region", () => {
        const p = measurePlacement(
            fakeGrid({
                cellLeft: 0,
                cellTop: 40,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.maxHeight).toBe(160);
    });

    it("offers MORE room when the cell is scrolled higher", () => {
        // "Move the edited cell upwards and the editor may grow further." The
        // editor never scrolls the grid itself to make room — it only uses what
        // the user has made available.
        const low = measurePlacement(
            fakeGrid({
                scrollTop: 0,
                cellLeft: 0,
                cellTop: 150,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        const high = measurePlacement(
            fakeGrid({
                scrollTop: 120,
                cellLeft: 0,
                cellTop: 150,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(low.maxHeight).toBe(50);
        expect(high.maxHeight).toBe(170);
    });

    it("never offers less height than the cell", () => {
        const p = measurePlacement(
            fakeGrid({
                cellLeft: 0,
                cellTop: 195,
                cellWidth: 100,
                cellHeight: 24,
            }),
            at,
        )!;
        expect(p.maxHeight).toBe(24);
    });
});
