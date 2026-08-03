import { describe, expect, it } from "vitest";
import {
    SelectionController,
    bounds,
    contains,
} from "../../src/views/spreadsheet-view/SelectionController";

describe("bounds", () => {
    it("sorts corners when the anchor is below and right of the head", () => {
        expect(
            bounds({ anchor: { row: 5, col: 7 }, head: { row: 2, col: 3 } }),
        ).toEqual({ top: 2, left: 3, bottom: 5, right: 7 });
    });

    it("treats a single cell as 1x1", () => {
        expect(
            bounds({ anchor: { row: 3, col: 3 }, head: { row: 3, col: 3 } }),
        ).toEqual({ top: 3, left: 3, bottom: 3, right: 3 });
    });
});

describe("contains", () => {
    const range = { anchor: { row: 1, col: 1 }, head: { row: 3, col: 4 } };

    it("includes both corners", () => {
        expect(contains(range, 1, 1)).toBe(true);
        expect(contains(range, 3, 4)).toBe(true);
    });

    it("excludes cells just outside each edge", () => {
        expect(contains(range, 0, 2)).toBe(false);
        expect(contains(range, 4, 2)).toBe(false);
        expect(contains(range, 2, 0)).toBe(false);
        expect(contains(range, 2, 5)).toBe(false);
    });

    it("works on a range dragged backwards", () => {
        expect(
            contains({ anchor: { row: 3, col: 4 }, head: { row: 1, col: 1 } }, 2, 2),
        ).toBe(true);
    });
});

describe("SelectionController", () => {
    it("starts empty", () => {
        const c = new SelectionController();
        expect(c.getRanges()).toEqual([]);
        expect(c.getActiveCell()).toBeNull();
    });

    it("begin creates a 1x1 range and sets the active cell", () => {
        const c = new SelectionController();
        c.begin(2, 3);
        expect(c.countCells()).toBe(1);
        expect(c.getActiveCell()).toEqual({ row: 2, col: 3 });
    });

    it("extendTo moves the head and leaves the anchor put", () => {
        // A fixed anchor is what makes drag and shift+click agree.
        const c = new SelectionController();
        c.begin(2, 3);
        c.extendTo(5, 7);
        expect(c.getRanges()[0]).toEqual({
            anchor: { row: 2, col: 3 },
            head: { row: 5, col: 7 },
        });
    });

    it("extending does not move the active cell", () => {
        const c = new SelectionController();
        c.begin(2, 3);
        c.extendTo(5, 7);
        expect(c.getActiveCell()).toEqual({ row: 2, col: 3 });
    });

    it("extendTo does nothing before a gesture starts", () => {
        const c = new SelectionController();
        c.extendTo(4, 4);
        expect(c.getRanges()).toEqual([]);
    });

    it("begin replaces the selection, or adds when additive", () => {
        const c = new SelectionController();
        c.begin(0, 0);
        c.begin(5, 5);
        expect(c.getRanges()).toHaveLength(1);
        c.begin(9, 9, true);
        expect(c.getRanges()).toHaveLength(2);
    });

    it("extendTo only grows the most recent range", () => {
        const c = new SelectionController();
        c.begin(0, 0);
        c.begin(5, 5, true);
        c.extendTo(7, 7);
        expect(c.getRanges()[0].head).toEqual({ row: 0, col: 0 });
        expect(c.getRanges()[1].head).toEqual({ row: 7, col: 7 });
    });

    it("endDrag clears the flag but keeps the selection", () => {
        const c = new SelectionController();
        c.begin(1, 1);
        expect(c.getSnapshot().dragging).toBe(true);
        c.endDrag();
        expect(c.getSnapshot().dragging).toBe(false);
        expect(c.getRanges()).toHaveLength(1);
    });

    it("clear drops everything", () => {
        const c = new SelectionController();
        c.begin(1, 1);
        c.clear();
        expect(c.getRanges()).toEqual([]);
        expect(c.getActiveCell()).toBeNull();
    });

    it("isSelected reports membership across ranges", () => {
        const c = new SelectionController();
        c.begin(0, 0);
        c.extendTo(1, 1);
        c.begin(5, 5, true);
        expect(c.isSelected(1, 1)).toBe(true);
        expect(c.isSelected(5, 5)).toBe(true);
        expect(c.isSelected(3, 3)).toBe(false);
    });

    it("countCells multiplies the sides and sums across ranges", () => {
        const c = new SelectionController();
        c.begin(0, 0);
        c.extendTo(2, 3); // 3x4
        expect(c.countCells()).toBe(12);
        c.begin(9, 9, true);
        expect(c.countCells()).toBe(13);
    });
});

describe("subscriptions", () => {
    it("notifies on every change", () => {
        const c = new SelectionController();
        let calls = 0;
        c.subscribe(() => calls++);
        c.begin(0, 0);
        c.extendTo(1, 1);
        expect(calls).toBe(2);
    });

    it("returns a stable snapshot until something changes", () => {
        // useSyncExternalStore compares by reference; a fresh object would loop.
        const c = new SelectionController();
        c.begin(0, 0);
        expect(c.getSnapshot()).toBe(c.getSnapshot());
    });

    it("does not notify when the head has not moved", () => {
        // A stationary pointer keeps firing mouseenter.
        const c = new SelectionController();
        c.begin(2, 2);
        let calls = 0;
        c.subscribe(() => calls++);
        c.extendTo(2, 2);
        expect(calls).toBe(0);
    });

    it("does not notify on no-op clear or endDrag", () => {
        const c = new SelectionController();
        let calls = 0;
        c.subscribe(() => calls++);
        c.clear();
        c.endDrag();
        expect(calls).toBe(0);
    });

    it("stops notifying after unsubscribe", () => {
        const c = new SelectionController();
        let calls = 0;
        const off = c.subscribe(() => calls++);
        c.begin(0, 0);
        off();
        c.extendTo(3, 3);
        expect(calls).toBe(1);
    });

    it("survives a listener unsubscribing mid-notification", () => {
        const c = new SelectionController();
        const seen: string[] = [];
        const off = c.subscribe(() => {
            seen.push("one");
            off();
        });
        c.subscribe(() => seen.push("two"));
        expect(() => c.begin(0, 0)).not.toThrow();
        expect(seen).toEqual(["one", "two"]);
    });
});
