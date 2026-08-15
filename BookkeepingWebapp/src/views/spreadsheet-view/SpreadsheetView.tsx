import { memo, useCallback, useEffect, useRef } from "react";
import { TableLayoutLayer, type LayoutCell } from "./TableLayoutLayer";
import { SelectionRangeLayer } from "./SelectionRangeLayer";
import { useDragAutoScroll } from "./useDragAutoScroll";
import { type CellAddress, type SpreadsheetViewProps } from "./types";
import "./SpreadsheetView.css";

/**
 * A data-driven grid.
 *
 *   TableLayoutLayer     the table, drawn by table-view's behaviour-less TableView
 *   SelectionRangeLayer  the selection, drawn as boxes over the table
 *   SelectionController  who owns the selection; held by the host
 *
 * The selection deliberately never reaches `getCell`. If it did, that closure
 * would change identity on every selection change and the whole table would
 * re-render — measured at 650 `getCell` calls for a twelve-cell drag, versus 0.
 */
/**
 * React appends `px` to numbers but passes strings through verbatim, so a bare
 * `"220"` becomes invalid CSS and the browser drops the declaration silently — no
 * bound, no overflow, no scrollbar. Unitless digits are therefore read as pixels.
 */
const css = (value: string | number) =>
    typeof value === "string" && /^\d+(\.\d+)?$/.test(value)
        ? `${value}px`
        : value;

function SpreadsheetViewInner<TData>(props: SpreadsheetViewProps<TData>) {
    console.log("SpreadsheetView rerender")

    const {
        data,
        getRowCount,
        getColumnCount,
        getCell,
        getColumnHeader,
        getRowHeader,
        getRowKey,
        onCellClick,
        onEditBegin,
        selectionController,
        editable = false,
        multiline = false,
        className,
        viewportWidth,
        viewportHeight,
    } = props;

    const scrollRef = useRef<HTMLDivElement>(null);
    // A ref, not state: a drag crosses dozens of cells and must not re-render.
    const dragging = useRef(false);

    // Dragging to the edge scrolls the viewport, which needs pointer coordinates
    // and a clock — neither of which a cell event can supply.
    const extendTo = useCallback(
        (row: number, col: number) => selectionController?.extendTo(row, col),
        [selectionController],
    );
    const stopAutoScroll = useDragAutoScroll({
        scrollRef,
        active: dragging,
        onCellUnderPointer: extendTo,
    });

    // A drag usually ends outside the grid, so the release is caught on the window.
    useEffect(() => {
        if (!selectionController) return;
        const finish = () => {
            if (!dragging.current) return;
            dragging.current = false;
            // Before `endDrag`, so no frame can land after the gesture is over.
            stopAutoScroll();
            selectionController.endDrag();
        };
        window.addEventListener("mouseup", finish);
        window.addEventListener("blur", finish);
        return () => {
            window.removeEventListener("mouseup", finish);
            window.removeEventListener("blur", finish);
        };
    }, [selectionController, stopAutoScroll]);

    return (
        <div
            ref={scrollRef}
            className="spreadsheet-viewport"
            // Maxima, not fixed sizes: the viewport bounds the table and scrolls
            // beyond it, rather than forcing a small table into a large box.
            style={{ width: css(viewportWidth), height: css(viewportHeight), overflow: "scroll"}}
        >
            <TableLayoutLayer<TData>
                data={data}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={(row, col): LayoutCell => {
                    const cell = getCell(data, row, col);
                    return {
                        value: cell.value,
                        editable: cell.editable ?? editable,
                        multiline: cell.multiline ?? multiline,
                        align: cell.align,
                        className: cell.className,
                        tooltip: cell.tooltip,
                    };
                }}
                getRowKey={getRowKey ? (row) => getRowKey(data, row) : (row) => row}
                // Omitted stays omitted: absence is how the layer knows there is
                // no gutter or header strip.
                getRowHeader={getRowHeader ? (row) => getRowHeader(data, row) : undefined}
                getColumnHeader={
                    getColumnHeader ? (col) => getColumnHeader(data, col) : undefined
                }
                className={className}
                // Selection starts on press, not on click: a drag has to begin
                // before it ends.
                onCellPointerDown={(row, col, additive) => {
                    if (!selectionController) return;
                    dragging.current = true;
                    selectionController.begin(row, col, additive);
                }}
                onCellPointerEnter={(row, col) => {
                    if (dragging.current) selectionController?.extendTo(row, col);
                }}
                onCellSelect={(row, col) => onCellClick?.(row, col, data)}
                onCellBeginEdit={(row, col) => onEditBegin?.(row, col, data)}
            />
            {selectionController && (
                <SelectionRangeLayer
                    controller={selectionController}
                    scrollRef={scrollRef}
                />
            )}
        </div>
    );
}

/**
 * Memoized, and that is part of the contract rather than a tuning detail: a host
 * that subscribes to the selection (to show a readout, say) re-renders on every
 * selection change, and without this the grid would be dragged along with it —
 * undoing the whole point of keeping the selection out of the render tree.
 *
 * `memo` compares props shallowly, so it only bites if the host keeps its
 * callbacks stable (`useCallback`, module constants, or a subscribing sibling
 * instead of a subscribing parent). Inline arrow props defeat it.
 *
 * The cast restores the generic that `memo` erases.
 */

export const SpreadsheetView = memo(
    SpreadsheetViewInner,
) as typeof SpreadsheetViewInner;

export default SpreadsheetView;

export type { CellAddress };
