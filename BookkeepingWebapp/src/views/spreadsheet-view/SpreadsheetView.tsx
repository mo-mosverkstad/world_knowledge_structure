import { TableLayoutLayer, type LayoutCell } from "./TableLayoutLayer";
import { type CellAddress, type SpreadsheetViewProps } from "./types";

/**
 * SpreadsheetView — a data-driven grid.
 *
 * Composition
 * -----------
 *   - `types.ts`         — the public data contract.
 *   - `TableLayoutLayer` — how it looks: table markup, layout, `<colgroup>`.
 *       - `Row` / `Cell` — markup for one row / one cell.
 *
 * not built yet: selection, editing, the editor overlay, column headers,
 * scrolling and sizing.
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
        editable = false,
        multiline = false,
        className,
    } = props;

    return (
        <TableLayoutLayer<TData>

            data={data}
            getRowCount={getRowCount}
            getColumnCount={getColumnCount}

            // Bind `data` and resolve the per-cell overrides against the
            // view-wide defaults, so the layer receives no optional policy.
            getCell={(row, col): LayoutCell => {
                const cell = getCell(data, row, col);
                return {
                    value: cell.value,
                    // Selection is not built yet, so no cell is ever active.
                    active: false,
                    editable: cell.editable ?? editable,
                    multiline: cell.multiline ?? multiline,
                    align: cell.align,
                    className: cell.className,
                    tooltip: cell.tooltip,
                };
            }}
            // Identity when the caller supplies it, position otherwise.
            getRowKey={getRowKey ? (row) => getRowKey(data, row) : (row) => row}
            // Omitted stays omitted: that is how the layer knows there is no
            // gutter or header strip, rather than being told separately.
            getRowHeader={
                getRowHeader ? (row) => getRowHeader(data, row) : undefined
            }
            getColumnHeader={
                getColumnHeader ? (col) => getColumnHeader(data, col) : undefined
            }
            className={className}
            onCellSelect={(row, col) => {
                onCellClick?.(row, col, data);
                console.log(`select cell (${row}, ${col})`);
            }}
            onCellBeginEdit={(row, col) => {
                onEditBegin?.(row, col, data);
                console.log(`begin edit cell (${row}, ${col})`);
            }}
        />
    );
}

export default SpreadsheetView;

export type { CellAddress };
