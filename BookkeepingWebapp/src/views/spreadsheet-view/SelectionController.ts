import { useRef } from "react";
import { type CellAddress } from "./types";

/** A selected block, kept as the gesture's two corners. `anchor` does not move. */
export interface SelectionRange {
    anchor: CellAddress;
    head: CellAddress;
}

export interface SelectionSnapshot {
    ranges: readonly SelectionRange[];
    activeCell: CellAddress | null;
    dragging: boolean;
}

export interface Bounds {
    top: number;
    left: number;
    bottom: number;
    right: number;
}

/** Sort the corners; the anchor may be below or right of the head. */
export function bounds(range: SelectionRange): Bounds {
    const { anchor, head } = range;
    return {
        top: Math.min(anchor.row, head.row),
        left: Math.min(anchor.col, head.col),
        bottom: Math.max(anchor.row, head.row),
        right: Math.max(anchor.col, head.col),
    };
}

export function contains(
    range: SelectionRange,
    row: number,
    col: number,
): boolean {
    const b = bounds(range);
    return row >= b.top && row <= b.bottom && col >= b.left && col <= b.right;
}

const EMPTY: SelectionSnapshot = {
    ranges: [],
    activeCell: null,
    dragging: false,
};

/**
 * Selection state, held outside React so changing it re-renders only the overlay
 * that subscribes — not the table.
 */
export class SelectionController {
    private snapshot = EMPTY;
    private readonly listeners = new Set<() => void>();

    readonly subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    /** Must return the same object until something changes. */
    readonly getSnapshot = () => this.snapshot;

    private publish(next: SelectionSnapshot) {
        this.snapshot = next;
        for (const listener of [...this.listeners]) listener();
    }

    begin(row: number, col: number, additive = false) {
        const range = { anchor: { row, col }, head: { row, col } };
        this.publish({
            ranges: additive ? [...this.snapshot.ranges, range] : [range],
            activeCell: range.anchor,
            dragging: true,
        });
    }

    extendTo(row: number, col: number) {
        const { ranges, activeCell, dragging } = this.snapshot;
        const last = ranges[ranges.length - 1];
        // A pointer sitting still keeps firing mouseenter; skip the redraw.
        if (!last || (last.head.row === row && last.head.col === col)) return;
        this.publish({
            ranges: [...ranges.slice(0, -1), { anchor: last.anchor, head: { row, col } }],
            activeCell,
            dragging,
        });
    }

    endDrag() {
        if (!this.snapshot.dragging) return;
        this.publish({ ...this.snapshot, dragging: false });
    }

    selectRange(anchor: CellAddress, head: CellAddress) {
        this.publish({ ranges: [{ anchor, head }], activeCell: anchor, dragging: false });
    }

    clear() {
        if (this.snapshot === EMPTY) return;
        this.publish(EMPTY);
    }

    getRanges() {
        return this.snapshot.ranges;
    }

    getActiveCell() {
        return this.snapshot.activeCell;
    }

    isSelected(row: number, col: number) {
        return this.snapshot.ranges.some((r) => contains(r, row, col));
    }

    countCells() {
        return this.snapshot.ranges.reduce((sum, range) => {
            const b = bounds(range);
            return sum + (b.bottom - b.top + 1) * (b.right - b.left + 1);
        }, 0);
    }
}

/** One controller for the host's lifetime. A ref, so it never triggers a render. */
export function useSelectionController(): SelectionController {
    const ref = useRef<SelectionController | null>(null);
    if (!ref.current) ref.current = new SelectionController();
    return ref.current;
}
