import { describe, expect, it } from "vitest";
import {
    autoScrollVelocity,
    EDGE_THRESHOLD,
    MAX_SPEED,
    SPEED_RAMP,
    type EdgeRect,
} from "../../src/views/spreadsheet-view/autoScrollVelocity";

/** A 400x300 viewport at the origin. */
const RECT: EdgeRect = { top: 0, left: 0, right: 400, bottom: 300 };

const at = (x: number, y: number) => autoScrollVelocity(RECT, { x, y });

describe("no scrolling in the comfortable middle", () => {
    it("stands still at the centre", () => {
        expect(at(200, 150)).toEqual({ vx: 0, vy: 0 });
    });

    it("stands still just inside the trigger band", () => {
        // The band is INSIDE the edge, so this is still quiet.
        expect(at(200, 300 - EDGE_THRESHOLD - 1)).toEqual({ vx: 0, vy: 0 });
        expect(at(EDGE_THRESHOLD + 1, 150)).toEqual({ vx: 0, vy: 0 });
    });

    it("stands still exactly on the band's boundary", () => {
        // Zero overshoot is zero speed, so the ramp starts continuously rather
        // than jumping to a minimum rate.
        expect(at(200, 300 - EDGE_THRESHOLD)).toEqual({ vx: 0, vy: 0 });
    });
});

describe("scrolling starts before the pointer leaves", () => {
    /*
     * The point of a band inside the edge: reaching the last row must not
     * require leaving the element, or the gesture stalls where it matters.
     */
    it("scrolls down while still over the last cells", () => {
        const { vy } = at(200, 300 - EDGE_THRESHOLD + 4);
        expect(vy).toBeGreaterThan(0);
    });

    it("scrolls up while still inside the top edge", () => {
        const { vy } = at(200, EDGE_THRESHOLD - 4);
        expect(vy).toBeLessThan(0);
    });
});

describe("direction", () => {
    it("past the bottom scrolls down", () => {
        expect(at(200, 400).vy).toBeGreaterThan(0);
    });

    it("past the top scrolls up", () => {
        expect(at(200, -100).vy).toBeLessThan(0);
    });

    it("past the right scrolls right", () => {
        expect(at(500, 150).vx).toBeGreaterThan(0);
    });

    it("past the left scrolls left", () => {
        expect(at(-100, 150).vx).toBeLessThan(0);
    });

    it("a corner scrolls both axes at once", () => {
        // Excel scrolls diagonally; treating the axes independently gives that
        // for free.
        const { vx, vy } = at(500, 400);
        expect(vx).toBeGreaterThan(0);
        expect(vy).toBeGreaterThan(0);
    });

    it("one axis out of bounds leaves the other alone", () => {
        expect(at(200, 400).vx).toBe(0);
        expect(at(500, 150).vy).toBe(0);
    });
});

describe("speed rises with distance", () => {
    /*
     * A constant rate is both too slow to cross a long sheet and too fast to
     * land on a row. The ramp is what lets one gesture do both.
     */
    it("further out is faster", () => {
        expect(at(200, 400).vy).toBeGreaterThan(at(200, 340).vy);
    });

    it("follows the ramp", () => {
        // 10px past the band.
        expect(at(200, 300 - EDGE_THRESHOLD + 10).vy).toBe(10 * SPEED_RAMP);
    });

    it("is symmetric in both directions", () => {
        const down = at(200, 300 - EDGE_THRESHOLD + 10).vy;
        const up = at(200, EDGE_THRESHOLD - 10).vy;
        expect(up).toBe(-down);
    });
});

describe("speed is capped", () => {
    it("a pointer flung far away does not teleport the view", () => {
        expect(at(200, 100_000).vy).toBe(MAX_SPEED);
        expect(at(200, -100_000).vy).toBe(-MAX_SPEED);
        expect(at(100_000, 150).vx).toBe(MAX_SPEED);
        expect(at(-100_000, 150).vx).toBe(-MAX_SPEED);
    });
});

describe("awkward geometry", () => {
    it("respects a caller-supplied threshold", () => {
        const rect = RECT;
        expect(autoScrollVelocity(rect, { x: 200, y: 280 }, 10)).toEqual({
            vx: 0,
            vy: 0,
        });
        expect(
            autoScrollVelocity(rect, { x: 200, y: 295 }, 10).vy,
        ).toBeGreaterThan(0);
    });

    it("a viewport thinner than two bands still scrolls forward", () => {
        // The bands overlap, so every point is in both. Deadlocking would be the
        // bug; moving toward the end is the useful answer.
        const thin: EdgeRect = { top: 0, left: 0, right: 400, bottom: 20 };
        expect(autoScrollVelocity(thin, { x: 200, y: 10 }).vy).toBeGreaterThan(0);
    });

    it("works for a viewport that is not at the origin", () => {
        // A real container is offset from the page corner; the rect is in client
        // coordinates, so the maths must not assume 0,0.
        const offset: EdgeRect = { top: 100, left: 50, right: 450, bottom: 400 };
        expect(autoScrollVelocity(offset, { x: 250, y: 250 })).toEqual({
            vx: 0,
            vy: 0,
        });
        expect(autoScrollVelocity(offset, { x: 250, y: 500 }).vy).toBeGreaterThan(
            0,
        );
        expect(autoScrollVelocity(offset, { x: 250, y: 90 }).vy).toBeLessThan(0);
    });
});
