import { useEffect, useRef } from "react";
import { TableLayoutLayer, type LayoutCell } from "./TableLayoutLayer";
import { SelectionRangeLayer } from "./SelectionRangeLayer";
import { type CellAddress, type SpreadsheetViewProps } from "./types";
import "./SpreadsheetView.css";

/**
 * A data-driven grid.
 *
 *   TableLayoutLayer     the table markup (Row, Cell, ColumnHeader)
 *   SelectionRangeLayer  the selection, drawn as boxes over the table
 *   SelectionController  who owns the selection; held by the host
 *
 * The selection deliberately never reaches `getCell`. If it did, that closure
 * would change identity on every selection change and the whole table would
 * re-render — measured at 650 `getCell` calls for a twelve-cell drag, versus 0.
 */
export function SpreadsheetView<TData>(props: SpreadsheetViewProps<TData>) {
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

    // A drag usually ends outside the grid, so the release is caught on the window.
    useEffect(() => {
        if (!selectionController) return;
        const finish = () => {
            if (!dragging.current) return;
            dragging.current = false;
            selectionController.endDrag();
        };
        window.addEventListener("mouseup", finish);
        window.addEventListener("blur", finish);
        return () => {
            window.removeEventListener("mouseup", finish);
            window.removeEventListener("blur", finish);
        };
    }, [selectionController]);

    return (
        <div
            ref={scrollRef}
            className="spreadsheet-viewport"
            // Maxima, not fixed sizes: the viewport bounds the table and scrolls
            // beyond it, rather than forcing a small table into a large box.
            style={{ maxWidth: viewportWidth, maxHeight: viewportHeight }}
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

export default SpreadsheetView;

export type { CellAddress };
