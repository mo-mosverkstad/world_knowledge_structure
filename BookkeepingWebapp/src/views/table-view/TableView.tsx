import { type ReactNode } from "react";
import { Row } from "./Row";
import { Cell } from "./Cell";
import { ColumnHeader, CornerCell } from "./ColumnHeader";
import "./TableView.css";

/** How one cell should appear. Fully resolved — no defaults left to apply. */
export interface LayoutCell {
    value: ReactNode;
    editable: boolean;
    multiline: boolean;
    align?: "left" | "center" | "right";
    className?: string;
    tooltip?: string;
}

export interface TableViewProps<TData> {
    data: TData;
    getRowCount: (data: TData) => number;
    getColumnCount: (data: TData) => number;

    /** Bound to the caller's data; called once per rendered element. */
    getCell: (row: number, col: number) => LayoutCell;
    getRowKey: (row: number) => string | number;
    /** Omit for no gutter / no header strip. */
    getRowHeader?: (row: number) => ReactNode;
    getColumnHeader?: (col: number) => ReactNode;

    className?: string;

    onCellSelect?: (row: number, col: number) => void;
    onCellBeginEdit?: (row: number, col: number) => void;
    onCellPointerDown?: (row: number, col: number, additive: boolean) => void;
    onCellPointerEnter?: (row: number, col: number) => void;
}

/**
 * Owns everything about how the grid is drawn: that it is a `<table>`, that rows
 * are `<tr>` and cells are `<td>`, how columns are sized.
 *
 * It DRAWS and nothing else. Every gesture is reported through a callback and no
 * decision is taken here, so no state, no selection and no editing lives in this
 * subtree — a behaviour is whatever the caller wires to `onCell*`.
 *
 * Cells are PULLED as they render rather than passed in as an array, so nothing is
 * materialised and a virtualized version can ask for only the visible window.
 */
export function TableView<TData>(props: TableViewProps<TData>) {
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
        onCellPointerDown,
        onCellPointerEnter,
    } = props;

    const rowCount = getRowCount(data);
    const columnCount = getColumnCount(data);
    const hasRowHeaders = getRowHeader !== undefined;

    const rows: ReactNode[] = [];
    for (let row = 0; row < rowCount; row++) {
        const cells: ReactNode[] = [];
        for (let col = 0; col < columnCount; col++) {
            const cell = getCell(row, col);
            cells.push(
                <Cell
                    key={col}
                    value={cell.value}
                    editable={cell.editable}
                    multiline={cell.multiline}
                    align={cell.align}
                    className={cell.className}
                    tooltip={cell.tooltip}
                    row={row}
                    col={col}
                    onSelect={() => onCellSelect?.(row, col)}
                    onBeginEdit={() => onCellBeginEdit?.(row, col)}
                    onPointerDown={(additive) => onCellPointerDown?.(row, col, additive)}
                    onPointerEnter={() => onCellPointerEnter?.(row, col)}
                />,
            );
        }
        rows.push(
            <Row key={getRowKey(row)} header={getRowHeader?.(row)}>
                {cells}
            </Row>,
        );
    }

    return (
        <table
            className={className ? `table-layout ${className}` : "table-layout"}
            // A <table> maps to `table`; `grid` is the interactive counterpart.
            role="grid"
        >
            {/* One <col> per column, so a column is sized once rather than by
                every cell repeating a width. */}
            <colgroup>
                {hasRowHeaders && <col className="table-layout__gutter-col" />}
                {Array.from({ length: columnCount }, (_, col) => (
                    <col key={col} />
                ))}
            </colgroup>
            {getColumnHeader && (
                <thead>
                    <tr className="table-layout__header-row">
                        {hasRowHeaders && <CornerCell />}
                        {Array.from({ length: columnCount }, (_, col) => (
                            <ColumnHeader key={col}>{getColumnHeader(col)}</ColumnHeader>
                        ))}
                    </tr>
                </thead>
            )}
            <tbody>{rows}</tbody>
        </table>
    );
}
