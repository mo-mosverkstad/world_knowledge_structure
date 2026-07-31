import { useRef, type ReactNode } from "react";
import "./style.css";
import { Grid } from "./Grid";
import { Row } from "./Row";
import { Cell } from "./Cell";
import { ColumnHeader, CornerCell } from "./ColumnHeader";
import { useSelection } from "./useSelection";
import { useEditing } from "./useEditing";
import { useReturnFocus } from "./useReturnFocus";
import {
    type CellAddress,
    type SpreadsheetViewProps,
} from "./types";

/**
 * SpreadsheetView — a data-driven spreadsheet/grid and behavior coordinator.
 *
 * Architecture (mirrors the tab-bar module)
 * -----------------------------------------
 * `SpreadsheetView` renders no raw HTML and holds no primitive state of its own.
 * It is a thin composition of focused pieces, each in its own module:
 *
 *   - `types.ts`        — the public data contract (props, descriptors).
 *   - `Grid`/`Row`/`Cell` — internal UI: container, row, and single-cell markup.
 *                          `Cell` also translates raw DOM events into semantic
 *                          ones (select / begin-edit / commit / cancel) and
 *                          hosts the inline editor.
 *   - `ColumnHeader`    — internal UI: one column-header cell, plus the corner
 *                          square above the row-number gutter.
 *   - `useSelection`    — the "which cell is active" concern (controlled/
 *                          uncontrolled, click select, arrow-key move, clamp,
 *                          change notify). This is the seam for keeping logical
 *                          selection state OUTSIDE the component.
 *   - `useEditing`      — the ephemeral editing state (editing cell + draft).
 *   - `useReturnFocus`  — gives keyboard focus back to the container when the
 *                          inline editor closes, so navigation keeps working.
 *
 * The UI layer renders a native `<table>`; see `Grid.tsx` for why (column-scoped
 * widths, intrinsic sizing, collapsed borders, native spanning, real header
 * semantics). Because that layer is encapsulated, moving from `div`s to a table
 * changed no behavior and no public API — this coordinator names only *what*
 * appears, never *which element* it is.
 *
 * Data-driven contract (see `types.ts` for full docs)
 * ---------------------------------------------------
 *   1. `data`     — the DATA PORT: an arbitrary business data structure.
 *   2. access cbs — `getRowCount` / `getColumnCount` / `getCell` (+ optional
 *                   `getColumnHeader`). Random access, because a grid renders a
 *                   rectangular region and pairs with virtualization later.
 *   3. mutate cb  — `onCellEdit`.
 *   4. behavior   — `onCellClick`, `onSelectionChange` (caller-defined).
 *
 * NOTE: virtualization / a layout engine are intentionally NOT built yet. The
 * random-access `getCell` contract is shaped so a viewport can later ask for
 * only the visible rows/cols without changing this public API.
 */
export function SpreadsheetView<TData>(props: SpreadsheetViewProps<TData>) {
    const {
        data,
        getRowCount,
        getColumnCount,
        getCell,
        getColumnHeader,
        onCellEdit,
        onCellClick,
        onSelectionChange,
        editable = false,
        activeCell,
        defaultActiveCell,
        className,
    } = props;

    const rowCount = getRowCount(data);
    const colCount = getColumnCount(data);

    // ---- Encapsulated concern: selection ------------------------------
    const selection = useSelection({
        controlledCell: activeCell,
        defaultCell: defaultActiveCell,
        onChange: (cell) => onSelectionChange?.(cell, data),
    });

    // ---- Encapsulated concern: ephemeral editing ---------------------
    const editing = useEditing({
        onCommit: (cell, value) =>
            onCellEdit?.(cell.row, cell.col, value, data),
    });

    // ---- Encapsulated concern: focus restoration ----------------------
    // The editor <input> takes focus while it is open; when it unmounts the
    // browser drops focus to <body>, and the key handler below then never fires
    // again. Purely OBSERVES the editing flag — no commit path calls it, so
    // Enter, Escape and blur are all covered by the same three lines.
    const containerRef = useRef<HTMLDivElement>(null);
    useReturnFocus({ containerRef, isEditing: editing.isEditing });

    const isActive = (row: number, col: number) =>
        selection.activeCell?.row === row &&
        selection.activeCell?.col === col;

    const isEditing = (row: number, col: number) =>
        editing.editingCell?.row === row && editing.editingCell?.col === col;

    const beginEdit = (row: number, col: number, cellEditable: boolean) => {
        if (!cellEditable) return;
        const current = getCell(data, row, col);
        editing.begin({ row, col }, String(current.value ?? ""));
    };

    // ---- Optional column-header row -----------------------------------
    // Built from `ColumnHeader` / `CornerCell` rather than inline markup: this
    // used to emit raw <div>s here, which was the one place the coordinator knew
    // what element a header *is*.
    let columnHeader: ReactNode = undefined;
    if (getColumnHeader) {
        const headers: ReactNode[] = [];
        // Aligns the header strip with the row-number gutter.
        headers.push(<CornerCell key="__corner" />);
        for (let col = 0; col < colCount; col++) {
            headers.push(
                <ColumnHeader key={col}>
                    {getColumnHeader(data, col)}
                </ColumnHeader>,
            );
        }
        columnHeader = headers;
    }

    // ---- Column definitions -------------------------------------------
    // A <colgroup> makes width a property of the COLUMN instead of of every
    // individual cell, which is what keeps a column aligned without CSS having
    // to repeat the same width on each <td>. The gutter gets its own <col>.
    const columns: ReactNode[] = [];
    if (getColumnHeader) {
        columns.push(<col key="__gutter" className="grid__col-gutter" />);
    }
    for (let col = 0; col < colCount; col++) {
        columns.push(<col key={col} className="grid__col" />);
    }

    // ---- Render the grid body (rectangular region) --------------------
    // Random access per cell — the natural primitive for a grid, and the hook
    // that lets a future viewport request only visible [firstRow..lastRow] ×
    // [firstCol..lastCol] without touching this loop's shape.
    const rows: ReactNode[] = [];
    for (let row = 0; row < rowCount; row++) {
        const cells: ReactNode[] = [];
        for (let col = 0; col < colCount; col++) {
            const descriptor = getCell(data, row, col);
            const cellEditable =
                (descriptor.editable ?? editable) && onCellEdit !== undefined;

            // Capture loop coordinates for the handler closures.
            const r = row;
            const c = col;

            cells.push(
                <Cell
                    key={col}
                    value={descriptor.value}
                    align={descriptor.align}
                    className={descriptor.className}
                    tooltip={descriptor.tooltip}
                    active={isActive(row, col)}
                    editing={isEditing(row, col)}
                    editable={cellEditable}
                    draft={editing.draft}
                    onSelect={() => {
                        selection.select({ row: r, col: c });
                        onCellClick?.(r, c, data);
                    }}
                    onBeginEdit={() => beginEdit(r, c, cellEditable)}
                    onDraftChange={editing.change}
                    onCommitEdit={editing.commit}
                    onCancelEdit={editing.cancel}
                />,
            );
        }
        rows.push(
            <Row key={row} header={getColumnHeader ? row + 1 : undefined}>
                {cells}
            </Row>,
        );
    }

    // Keep the active cell within bounds if the grid shrank.
    selection.reconcile(rowCount, colCount);

    // ---- Grid-level keyboard navigation -------------------------------
    // Arrow keys move the selection; Enter/F2 begin editing the active cell.
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (editing.isEditing) return; // editor handles its own keys
        const move = (dRow: number, dCol: number) => {
            e.preventDefault();
            selection.move(dRow, dCol, rowCount, colCount);
        };
        switch (e.key) {
            case "ArrowUp":
                return move(-1, 0);
            case "ArrowDown":
                return move(1, 0);
            case "ArrowLeft":
                return move(0, -1);
            case "ArrowRight":
                return move(0, 1);
            case "Enter":
            case "F2": {
                const cell = selection.activeCell;
                if (cell) {
                    const d = getCell(data, cell.row, cell.col);
                    const cellEditable =
                        (d.editable ?? editable) && onCellEdit !== undefined;
                    if (cellEditable) {
                        e.preventDefault();
                        beginEdit(cell.row, cell.col, cellEditable);
                    }
                }
                return;
            }
            default:
                return;
        }
    };

    return (
        <div
            ref={containerRef}
            className="spreadsheet"
            onKeyDown={onKeyDown}
            // Container is focusable so it can receive navigation keys.
            tabIndex={0}
        >
            <Grid
                className={className}
                columnHeader={columnHeader}
                columns={columns}
            >
                {rows}
            </Grid>
        </div>
    );
}

export default SpreadsheetView;

// Re-exported here for convenience of internal callers; the public surface is
// index.tsx.
export type { CellAddress };
