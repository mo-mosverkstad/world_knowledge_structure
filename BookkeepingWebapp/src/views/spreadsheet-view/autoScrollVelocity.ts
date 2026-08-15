/**
 * How fast a drag past the viewport's edge should scroll.
 *
 * Kept pure and DOM-free so the behaviour that actually needs care — thresholds,
 * both directions of both axes, the speed ramp, the cap — is testable. jsdom has
 * no layout engine, so anything touching `getBoundingClientRect` or
 * `elementFromPoint` cannot be tested at all; everything worth asserting lives
 * here instead.
 */

/** The container's edges, in client (viewport) coordinates. */
export interface EdgeRect {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

export interface Point {
    x: number;
    y: number;
}

/** Pixels per second, per axis. Positive scrolls down / right. */
export interface Velocity {
    vx: number;
    vy: number;
}

/**
 * A band INSIDE the edge, not the edge itself: scrolling has to begin while the
 * pointer is still over the last cell, otherwise reaching the final row would
 * require leaving the element and the gesture would stall exactly where the user
 * wants it to continue.
 */
export const EDGE_THRESHOLD = 24;

/** Ramp from overshoot (px) to speed (px/s). 24px past the band ≈ 288 px/s. */
export const SPEED_RAMP = 12;

/** Fast enough to cross a long sheet, slow enough to stay aimable. */
export const MAX_SPEED = 1200;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

/**
 * Signed distance past the trigger band. Zero anywhere in the comfortable middle,
 * which is what lets the caller treat 0 as "stop the loop".
 */
function overshoot(p: number, min: number, max: number, threshold: number) {
    // Both bands overlap in a viewport narrower than 2*threshold. Bottom/right
    // is tested first, so a tiny viewport scrolls forward rather than deadlocking.
    if (p > max - threshold) return p - (max - threshold);
    if (p < min + threshold) return p - (min + threshold);
    return 0;
}

/**
 * The speed to scroll `rect` given a pointer at `point`.
 *
 * Speed rises with distance past the edge rather than being constant: a fixed
 * rate is simultaneously too slow to cross a long sheet and too fast to land on
 * a row, whereas a ramp lets the same gesture do both.
 */
export function autoScrollVelocity(
    rect: EdgeRect,
    point: Point,
    threshold: number = EDGE_THRESHOLD,
): Velocity {
    /*
     * A collapsed rect means the container is not laid out — `display: none`, not
     * yet mounted, or an environment without layout. Every point is then "past"
     * every edge, so without this guard a still pointer would scroll a box that
     * has nowhere to scroll.
     */
    if (rect.right <= rect.left || rect.bottom <= rect.top) {
        return { vx: 0, vy: 0 };
    }

    const dx = overshoot(point.x, rect.left, rect.right, threshold);
    const dy = overshoot(point.y, rect.top, rect.bottom, threshold);
    return {
        vx: clamp(dx * SPEED_RAMP, -MAX_SPEED, MAX_SPEED),
        vy: clamp(dy * SPEED_RAMP, -MAX_SPEED, MAX_SPEED),
    };
}
