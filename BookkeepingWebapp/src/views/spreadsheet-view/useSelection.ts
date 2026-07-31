import { useCallback, useEffect, useRef, useState } from "react";
import { type CellAddress } from "./types";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `useSelection` encapsulates the intrinsic "which cell is active" concern of a
 * grid, in both controlled and uncontrolled modes — the 2D analog of the tab
 * bar's `useActiveTab`:
 *   - remembers the active cell (uncontrolled) or defers to the caller
 *     (controlled, when `controlledCell` is provided, even if `null`);
 *   - exposes `select(cell)` for the coordinator to call on a click;
 *   - exposes `move(dRow, dCol)` for arrow-key navigation, clamped to bounds;
 *   - reconciles the active cell against the current grid size each render so a
 *     selection that falls outside a shrunken grid is clamped back in;
 *   - fires `onChange` exactly once whenever the resolved selection changes.
 *
 * Only *logical* selection lives here. Ephemeral render state (hover, DOM refs)
 * stays in the renderer.
 */

export interface UseSelectionOptions {
    /** Controlled selection. When provided, internal state is not used. */
    controlledCell?: CellAddress | null;
    /** Initial selection for the uncontrolled case. */
    defaultCell?: CellAddress;
    /** Called once whenever the resolved selection changes. */
    onChange?: (cell: CellAddress | null) => void;
}

export interface UseSelectionResult {
    /** The currently resolved active cell (controlled value or internal state). */
    activeCell: CellAddress | null;
    /** Select a specific cell (no-op in controlled mode). */
    select: (cell: CellAddress) => void;
    /**
     * Move the selection by a delta, clamped to `[0, rowCount) × [0, colCount)`.
     * Starts from (0,0) when nothing is selected yet. No-op in controlled mode.
     */
    move: (dRow: number, dCol: number, rowCount: number, colCount: number) => void;
    /**
     * Clamp the active cell against the current grid size. Call after computing
     * counts each render; if the selection is now out of bounds it is pulled
     * back in (or cleared when the grid is empty).
     */
    reconcile: (rowCount: number, colCount: number) => void;
}

function clamp(value: number, max: number): number {
    if (value < 0) return 0;
    if (value > max) return max;
    return value;
}

export function useSelection(
    options: UseSelectionOptions = {},
): UseSelectionResult {
    const { controlledCell, defaultCell, onChange } = options;
    const isControlled = controlledCell !== undefined;

    const [internalCell, setInternalCell] = useState<CellAddress | null>(
        defaultCell ?? null,
    );
    const activeCell = isControlled ? controlledCell : internalCell;

    const select = useCallback(
        (cell: CellAddress) => {
            if (!isControlled) setInternalCell(cell);
        },
        [isControlled],
    );

    const move = useCallback(
        (dRow: number, dCol: number, rowCount: number, colCount: number) => {
            if (isControlled) return;
            if (rowCount === 0 || colCount === 0) return;
            setInternalCell((prev) => {
                const base = prev ?? { row: 0, col: 0 };
                return {
                    row: clamp(base.row + dRow, rowCount - 1),
                    col: clamp(base.col + dCol, colCount - 1),
                };
            });
        },
        [isControlled],
    );

    // Deferred reconciliation so the coordinator can call it during its render
    // pass; the state update itself is scheduled in an effect.
    const pending = useRef<{ rowCount: number; colCount: number } | null>(null);
    const reconcile = useCallback((rowCount: number, colCount: number) => {
        pending.current = { rowCount, colCount };
    }, []);

    useEffect(() => {
        if (isControlled) return;
        const p = pending.current;
        if (!p) return;
        setInternalCell((prev) => {
            if (prev === null) return prev;
            if (p.rowCount === 0 || p.colCount === 0) return null;
            const clamped = {
                row: clamp(prev.row, p.rowCount - 1),
                col: clamp(prev.col, p.colCount - 1),
            };
            return clamped.row === prev.row && clamped.col === prev.col
                ? prev
                : clamped;
        });
    });

    // Notify on genuine changes only (compare by value, not reference).
    const prev = useRef<CellAddress | null>(activeCell ?? null);
    useEffect(() => {
        const a = prev.current;
        const b = activeCell;
        const changed =
            (a === null) !== (b === null) ||
            (a !== null && b !== null && (a.row !== b.row || a.col !== b.col));
        if (changed) {
            prev.current = b ?? null;
            onChange?.(b ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCell?.row, activeCell?.col, activeCell === null]);

    return { activeCell, select, move, reconcile };
}
