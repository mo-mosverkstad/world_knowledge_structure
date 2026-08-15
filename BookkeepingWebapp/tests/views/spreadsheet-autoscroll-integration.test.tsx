// @vitest-environment jsdom
/*
 * Auto-scroll wired into the view.
 *
 * jsdom has no layout engine, so the container's rect, its scroll range and
 * hit-testing all have to be supplied. Only the WIRING is asserted here — that a
 * held pointer keeps scrolling, that the selection follows, that the loop stops.
 * The arithmetic lives in `spreadsheet-autoscroll.test.ts`, where it needs no
 * stubs at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
    SpreadsheetView,
    useSelectionController,
    type CellDescriptor,
    type SelectionController,
} from "../../src/views/spreadsheet-view";

interface Sheet {
    rows: number;
    cols: number;
}

const sheet: Sheet = { rows: 100, cols: 4 };
const getRowCount = (d: Sheet) => d.rows;
const getColumnCount = (d: Sheet) => d.cols;
const ROW_HEIGHT = 24;

/** A 400x300 viewport at the page origin, with 100 rows of scrollable content. */
const VIEWPORT = { top: 0, left: 0, right: 400, bottom: 300 };

let scrollTop = 0;
let frameCallbacks: FrameRequestCallback[] = [];
let now = 0;

function setup() {
    const counter = { calls: 0 };
    let controller!: SelectionController;

    const getCell = (_d: Sheet, row: number, col: number): CellDescriptor => {
        counter.calls++;
        return { value: `${row}.${col}` };
    };

    function Host() {
        controller = useSelectionController();
        return (
            <SpreadsheetView<Sheet>
                data={sheet}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={getCell}
                selectionController={controller}
                viewportWidth={400}
                viewportHeight={300}
            />
        );
    }

    render(<Host />);
    const viewport = document.querySelector<HTMLElement>(".spreadsheet-viewport")!;

    // Give the container a size and a scroll range.
    viewport.getBoundingClientRect = () =>
        ({ ...VIEWPORT, width: 400, height: 300, x: 0, y: 0 }) as DOMRect;
    Object.defineProperty(viewport, "scrollTop", {
        get: () => scrollTop,
        // Clamped like a real element: 100 rows of 24px inside 300px.
        set: (v: number) =>
            (scrollTop = Math.max(0, Math.min(v, sheet.rows * ROW_HEIGHT - 300))),
        configurable: true,
    });

    /*
     * Hit-test by arithmetic: the row under a y coordinate is decided by how far
     * the content has scrolled. This is exactly what a geometry interface would
     * answer directly, and what `cellFromPoint` currently recovers from the DOM.
     */
    document.elementFromPoint = (_x: number, y: number) => {
        const row = Math.floor((y + scrollTop) / ROW_HEIGHT);
        return (
            document.querySelector(`[data-row="${row}"][data-col="1"]`) ??
            document.querySelector(`[data-row="${sheet.rows - 1}"][data-col="1"]`)
        );
    };

    return {
        counter,
        get controller() {
            return controller;
        },
        cell: (row: number, col: number) =>
            document.querySelector<HTMLElement>(
                `[data-row="${row}"][data-col="${col}"]`,
            )!,
    };
}

/** Run N animation frames, 16ms apart. */
function runFrames(count: number) {
    for (let i = 0; i < count; i++) {
        const due = frameCallbacks;
        frameCallbacks = [];
        if (due.length === 0) return i;
        now += 16;
        act(() => {
            for (const cb of due) cb(now);
        });
    }
    return count;
}

beforeEach(() => {
    scrollTop = 0;
    frameCallbacks = [];
    now = 0;
    // One clock for the test and the hook. The hook seeds its timer from
    // `performance.now()` and receives frame timestamps, so if those two run on
    // different clocks the first delta is meaningless.
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frameCallbacks.push(cb);
        return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
        frameCallbacks = [];
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("dragging to the edge scrolls the viewport", () => {
    it("does not scroll while the pointer stays inside", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 150 });
        runFrames(5);
        expect(scrollTop).toBe(0);
    });

    it("scrolls down when the pointer nears the bottom edge", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(5);
        expect(scrollTop).toBeGreaterThan(0);
    });

    it("keeps scrolling while the pointer is held STILL past the edge", () => {
        // The whole reason a clock is needed: no further events arrive.
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(3);
        const afterThree = scrollTop;
        runFrames(10);
        expect(scrollTop).toBeGreaterThan(afterThree);
    });

    it("extends the selection to the rows it scrolls past", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        expect(s.controller.countCells()).toBe(1);
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(20);
        // Anchored at row 1 and dragged down, so the range must have grown.
        expect(s.controller.countCells()).toBeGreaterThan(1);
        const b = s.controller.getRanges()[0];
        expect(Math.max(b.anchor.row, b.head.row)).toBeGreaterThan(1);
    });

    it("scrolls up when the pointer nears the top edge", () => {
        const s = setup();
        scrollTop = 500;
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: -20 });
        runFrames(5);
        expect(scrollTop).toBeLessThan(500);
    });

    it("stops at the end of the range instead of spinning", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 5000 });
        runFrames(400);
        const max = sheet.rows * ROW_HEIGHT - 300;
        expect(scrollTop).toBe(max);
        // The loop must have given up rather than queued another frame.
        expect(frameCallbacks).toHaveLength(0);
    });
});

describe("the loop is bounded by the gesture", () => {
    it("does not scroll when no drag is in progress", () => {
        setup();
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(5);
        expect(scrollTop).toBe(0);
    });

    it("stops on mouseup", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(2);
        const atRelease = scrollTop;

        fireEvent.mouseUp(window);
        runFrames(20);
        expect(scrollTop).toBe(atRelease);
    });

    it("stops when the pointer comes back inside", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(2);
        expect(scrollTop).toBeGreaterThan(0);

        fireEvent.mouseMove(window, { clientX: 200, clientY: 150 });
        const settled = scrollTop;
        runFrames(20);
        expect(scrollTop).toBe(settled);
    });

    it("stops when the window loses focus mid-drag", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(2);
        const atBlur = scrollTop;

        fireEvent.blur(window);
        runFrames(20);
        expect(scrollTop).toBe(atBlur);
    });
});

describe("auto-scroll does not re-render the table", () => {
    it("costs no getCell calls", () => {
        // Same contract as the rest of the gesture: the selection changes, the
        // table is never told.
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        s.counter.calls = 0;
        fireEvent.mouseMove(window, { clientX: 200, clientY: 320 });
        runFrames(30);
        fireEvent.mouseUp(window);
        expect(s.counter.calls).toBe(0);
    });
});
