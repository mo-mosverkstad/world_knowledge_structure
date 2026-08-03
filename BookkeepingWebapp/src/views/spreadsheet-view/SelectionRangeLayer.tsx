import {
    useCallback,
    useLayoutEffect,
    useState,
    useSyncExternalStore,
    type RefObject,
} from "react";
import {
    bounds,
    contains,
    type SelectionController,
    type SelectionRange as Range,
} from "./SelectionController";
import { SelectionRange, type Box } from "./SelectionRange";

export interface SelectionRangeLayerProps {
    controller: SelectionController;
    /** The scroll container; boxes are positioned inside its content box. */
    scrollRef: RefObject<HTMLElement | null>;
}

const findCell = (root: HTMLElement, row: number, col: number) =>
    root.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);

/**
 * Cell position relative to the container's content box. Column widths come from
 * the browser (`table-layout: auto`), so measuring is the only option.
 */
function measureCell(container: HTMLElement, cell: HTMLElement): Box {
    const c = container.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    return {
        left: r.left - c.left - container.clientLeft + container.scrollLeft,
        top: r.top - c.top - container.clientTop + container.scrollTop,
        width: r.width,
        height: r.height,
    };
}

/** Only the two corners are measured, so range size does not affect cost. */
function measureRange(container: HTMLElement, range: Range): Box | null {
    const b = bounds(range);
    const topLeft = findCell(container, b.top, b.left);
    const bottomRight = findCell(container, b.bottom, b.right);
    if (!topLeft || !bottomRight) return null;
    const first = measureCell(container, topLeft);
    const last = measureCell(container, bottomRight);
    return {
        left: first.left,
        top: first.top,
        width: last.left + last.width - first.left,
        height: last.top + last.height - first.top,
    };
}

/**
 * The only subscriber to the selection, so a selection change re-renders this and
 * nothing else. The table is never told.
 */
export function SelectionRangeLayer({
    controller,
    scrollRef,
}: SelectionRangeLayerProps) {
    const selection = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
    );
    const [boxes, setBoxes] = useState<(Box | null)[]>([]);
    const [activeBox, setActiveBox] = useState<Box | null>(null);

    const measure = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        setBoxes(selection.ranges.map((r) => measureRange(container, r)));
        const active = selection.activeCell;
        const cell = active && findCell(container, active.row, active.col);
        setActiveBox(cell ? measureCell(container, cell) : null);
    }, [scrollRef, selection]);

    // Layout effect so the box lands in the same frame as the change.
    useLayoutEffect(measure, [measure]);

    // Re-measure when cells move. Scrolling needs no handler: the overlay is
    // inside the scrolled content.
    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [scrollRef, measure]);

    return (
        <>
            {selection.ranges.map((range, i) => {
                const box = boxes[i];
                if (!box) return null;
                const active = selection.activeCell;
                return (
                    <SelectionRange
                        key={i}
                        box={box}
                        activeCellBox={
                            active && activeBox && contains(range, active.row, active.col)
                                ? activeBox
                                : undefined
                        }
                    />
                );
            })}
        </>
    );
}
