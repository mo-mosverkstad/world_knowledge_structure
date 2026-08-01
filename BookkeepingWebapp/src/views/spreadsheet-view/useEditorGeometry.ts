import {
    useCallback,
    useEffect,
    useState,
    type RefObject,
} from "react";
import { type CellAddress } from "./types";
import {
    measurePlacement,
    resolveEditorSize,
    type EditorPlacement,
    type EditorSize,
} from "./editorLadder";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `useEditorGeometry` answers: where does the floating editor go, and how big is
 * it? The size rules are a four-rung ladder (grow right, then wrap and grow down,
 * then scroll) implemented as a pure function in `editorLadder.ts`; this hook is
 * the part that reads the DOM and re-reads it when something moves.
 *
 * THREE TRIGGERS, ONLY ONE OF WHICH IS SCROLLING
 * ----------------------------------------------
 *   - SCROLL. Position needs no handler (the box is inside the scrolled content),
 *     but the size BOUNDS are relative to the visible region, so they change.
 *   - RELAYOUT. Column widths come from `table-layout: auto`, so new data, a late
 *     font or a window resize can move the cell with no scroll event at all. A
 *     `ResizeObserver` covers that; without it the box silently drifts.
 *   - THE DRAFT. Typing changes how much room the content wants, which is the
 *     whole point of the ladder. Reported by the editor via `contentMetrics`,
 *     because only the editor knows its own text.
 */

export interface ContentMetrics {
    /** Width of the longest line if it were never wrapped. */
    naturalWidth: number;
    /** Height the content needs at its current width. */
    contentHeight: number;
}

export interface EditorGeometry extends EditorSize {
    left: number;
    top: number;
    /** The cell's own height: the box is never shorter than the cell it covers. */
    minHeight: number;
}

export interface UseEditorGeometryOptions {
    /** The scroll container, which is also the overlay's containing block. */
    gridRef: RefObject<HTMLElement | null>;
    /** The cell being edited, or null when no edit is in progress. */
    cell: CellAddress | null;
    /**
     * What the content currently wants. Supplied by the editor after it renders,
     * since natural width can only be measured on the real element.
     */
    contentMetrics: ContentMetrics | null;
}

export function useEditorGeometry(
    options: UseEditorGeometryOptions,
): EditorGeometry | null {
    const { gridRef, cell, contentMetrics } = options;
    const [placement, setPlacement] = useState<EditorPlacement | null>(null);

    // `cell` is a fresh object each render, so depend on its fields.
    const row = cell?.row ?? null;
    const col = cell?.col ?? null;

    const remeasure = useCallback(() => {
        const grid = gridRef.current;
        if (!grid || row === null || col === null) {
            setPlacement(null);
            return;
        }
        const next = measurePlacement(grid, { row, col });
        setPlacement((prev) => {
            // Skip identical results, so a scroll that changes nothing relevant
            // cannot cause a render storm.
            if (
                prev &&
                next &&
                prev.left === next.left &&
                prev.top === next.top &&
                prev.cellWidth === next.cellWidth &&
                prev.maxWidth === next.maxWidth &&
                prev.minHeight === next.minHeight &&
                prev.maxHeight === next.maxHeight
            ) {
                return prev;
            }
            return next;
        });
    }, [gridRef, row, col]);

    useEffect(() => {
        remeasure();
    }, [remeasure]);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid || row === null || col === null) return;

        grid.addEventListener("scroll", remeasure, { passive: true });

        let observer: ResizeObserver | undefined;
        if (typeof ResizeObserver === "function") {
            observer = new ResizeObserver(remeasure);
            observer.observe(grid);
            const table = grid.querySelector("table");
            if (table) observer.observe(table);
        }

        return () => {
            grid.removeEventListener("scroll", remeasure);
            observer?.disconnect();
        };
    }, [gridRef, row, col, remeasure]);

    if (!placement) return null;

    // Before the editor has reported its content, fall back to the cell's own
    // size. That is rung 1, which is also the correct first frame: the box opens
    // cell-sized and grows on the next tick if the content needs more.
    const metrics: ContentMetrics = contentMetrics ?? {
        naturalWidth: placement.cellWidth,
        contentHeight: placement.minHeight,
    };

    const size = resolveEditorSize({
        cellWidth: placement.cellWidth,
        maxWidth: placement.maxWidth,
        minHeight: placement.minHeight,
        maxHeight: placement.maxHeight,
        naturalWidth: metrics.naturalWidth,
        contentHeight: metrics.contentHeight,
    });

    return {
        left: placement.left,
        top: placement.top,
        minHeight: placement.minHeight,
        ...size,
    };
}
