import { type ReactNode } from "react";
import { Row } from "./Row";
import { Cell } from "./Cell";
import { ColumnHeader, CornerCell } from "./ColumnHeader";
import "./TableLayoutLayer.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `TableLayoutLayer` owns EVERYTHING about how the grid is laid out and drawn:
 * that it is a native `<table>`, that rows are `<tr>` and cells are `<td>`, how
 * columns are sized, where the gutter sits. `SpreadsheetView` hands it bound
 * accessors and learns none of that.
 *
 * PULL, NOT PUSH
 * --------------
 * The layer is given `getCell(row, col)` and asks for cells as it renders them.
 * It is NOT given an array of cells. That matters for two reasons:
 *
 *   - No intermediate structure exists. A caller's data is read straight into
 *     elements, so nothing is duplicated in memory just to be handed across this
 *     boundary.
 *   - Only what is rendered is fetched. A virtualized version of this file asks
 *     for the visible window and nothing else — which is the entire reason the
 *     public contract is random-access rather than an iterator. Pre-building an
 *     array here would have thrown that away before it was ever used.
 *
 * MIXED BINDING — worth knowing
 * -----------------------------
 * `getCell`, `getRowKey` and `getRowHeader` arrive already BOUND to the caller's
 * data. `getRowCount` and `getColumnCount` are UNBOUND and take `data`, which is
 * why this file is generic over `TData`.
 *
 * Both work; the difference is what leaks. The bound accessors keep the domain
 * type out of this file entirely — it cannot inspect `data` even by accident. The
 * unbound pair means `data` is in scope here, so the type parameter has to be
 * threaded through. Binding those two as well (`rowCount: number`, or
 * `getRowCount: () => number`) would drop `TData` from this file and make the
 * seam uniform.
 *
 * WHY A NATIVE TABLE
 * ------------------
 * A grid needs every row's Nth cell to share a width. With `div`s that means
 * measuring and writing widths yourself; a table's layout algorithm already does
 * it, and `<colgroup>` lets one declaration size a whole column.
 * `border-collapse` also merges adjacent cell borders into a single 1px line
 * instead of a 2px seam.
 *
 * WHY THIS IS A SEAM
 * ------------------
 * Layout is the part most likely to be replaced — a virtualized viewport, a
 * canvas renderer, or CSS grid all render the same description differently. As
 * long as the props below stay the same, swapping this file changes no behaviour
 * and no public API.
 */

/** How one cell should appear. Fully resolved — no defaults left to apply. */
export interface LayoutCell {
    value: ReactNode;
    active: boolean;
    editable: boolean;
    multiline: boolean;
    align?: "left" | "center" | "right";
    className?: string;
    tooltip?: string;
}

export interface TableLayoutLayerProps<TData> {
    /** The caller's data structure, passed to the count accessors below. */
    data: TData;
    getRowCount: (data: TData) => number;
    getColumnCount: (data: TData) => number;

    // ---- Bound accessors, called once per rendered element ---------------
    /** How the cell at this position should appear. */
    getCell: (row: number, col: number) => LayoutCell;
    /** React's identity for a row. Position when the caller has nothing better. */
    getRowKey: (row: number) => string | number;
    /** Row gutter content, e.g. a row number. Omit the prop for no gutter. */
    getRowHeader?: (row: number) => ReactNode;
    /**
     * Column header content. Omit the prop for no header strip — that absence is
     * the switch, rather than a separate boolean that could disagree with it.
     */
    getColumnHeader?: (col: number) => ReactNode;

    className?: string;

    // ---- Events, reported with the position they came from ---------------
    onCellSelect?: (row: number, col: number) => void;
    onCellBeginEdit?: (row: number, col: number) => void;
}

export function TableLayoutLayer<TData>(props: TableLayoutLayerProps<TData>) {
    const {
        data,
        getRowCount,
        getColumnCount,
        getCell,
        getRowKey,
        getRowHeader,
        getColumnHeader,
        className,
        onCellSelect,
        onCellBeginEdit,
    } = props;

    // Read the counts once per render. The layer decides HOW MANY rows to draw,
    // which is the hook a virtualized version needs: it can ask for the total and
    // still render only a window of it.
    const rowCount = getRowCount(data);
    const columnCount = getColumnCount(data);

    const hasRowHeaders = getRowHeader !== undefined;
    const hasColumnHeaders = getColumnHeader !== undefined;

    /** One `<tr>`, pulling its own cells. */
    const renderRow = (row: number) => {
        const cells: ReactNode[] = [];
        for (let col = 0; col < columnCount; col++) {
            const cell = getCell(row, col);
            cells.push(
                <Cell
                    key={col}
                    value={cell.value}
                    active={cell.active}
                    editable={cell.editable}
                    multiline={cell.multiline}
                    align={cell.align}
                    className={cell.className}
                    tooltip={cell.tooltip}
                    row={row}
                    col={col}
                    onSelect={() => onCellSelect?.(row, col)}
                    onBeginEdit={() => onCellBeginEdit?.(row, col)}
                />,
            );
        }
        return (
            <Row key={getRowKey(row)} header={getRowHeader?.(row)}>
                {cells}
            </Row>
        );
    };

    const rows: ReactNode[] = [];
    for (let row = 0; row < rowCount; row++) rows.push(renderRow(row));

    return (
        <table
            className={className ? `table-layout ${className}` : "table-layout"}
            // A <table> maps to the ARIA role `table` (static). `grid` is the
            // interactive counterpart this widget actually implements, so it is
            // stated rather than inherited.
            role="grid"
        >
            {/*
             * One <col> per column. Widths are declared here so a column is sized
             * once, rather than every cell repeating a width and hoping they
             * agree. The gutter gets its own <col> when row headers are present.
             */}
            <colgroup>
                {hasRowHeaders && <col className="table-layout__gutter-col" />}
                {Array.from({ length: columnCount }, (_, col) => (
                    <col key={col} />
                ))}
            </colgroup>
            {/*
             * The header strip. A real <thead> rather than a first <tr>: that is
             * what makes these cells headers structurally, and the browser keeps
             * <thead> above <tbody> regardless of source order.
             */}
            {hasColumnHeaders && (
                <thead>
                    <tr className="table-layout__header-row">
                        {/* The corner sits above the gutter, so it exists only
                          * when the gutter does. */}
                        {hasRowHeaders && <CornerCell />}
                        {Array.from({ length: columnCount }, (_, col) => (
                            <ColumnHeader key={col}>
                                {getColumnHeader(col)}
                            </ColumnHeader>
                        ))}
                    </tr>
                </thead>
            )}
            <tbody>{rows}</tbody>
        </table>
    );
}
