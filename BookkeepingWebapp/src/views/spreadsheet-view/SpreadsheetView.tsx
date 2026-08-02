import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import "./style.css";
import { Grid } from "./Grid";
import { Row } from "./Row";
import { Cell } from "./Cell";
import { ColumnHeader, CornerCell } from "./ColumnHeader";
import { CellEditor } from "./CellEditor";
import {
    useEditorGeometry,
    type ContentMetrics,
} from "./useEditorGeometry";
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
 *   - `CellEditor`      — internal UI: the single floating edit box, drawn OVER
 *                          the table so it can grow past its cell.
 *   - `useEditorGeometry` — measures where that box goes.
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
 *   5. sizing     — `maxWidth` / `maxHeight` bound the scroll viewport, and so
 *                   also bound how far the floating editor may grow.
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
        getRowHeader,
        getRowKey,
        onCellEdit,
        onCellClick,
        onEditBegin,
        onSelectionChange,
        editable = false,
        multiline = false,
        maxWidth,
        maxHeight,
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

    // ---- Encapsulated concern: where the floating editor goes ---------
    // The editor lives OUTSIDE the table (see `CellEditor`), so its placement
    // has to be measured from the real cell rather than derived from props:
    // column widths come from `table-layout: auto`, i.e. from the browser.
    const scrollRef = useRef<HTMLDivElement>(null);
    // What the draft currently wants. Reported by the editor, which is the only
    // component that can measure its own text — a <textarea> cannot say how wide
    // it would like to be, so the editor uses a hidden mirror element.
    const [contentMetrics, setContentMetrics] =
        useState<ContentMetrics | null>(null);
    const editorGeometry = useEditorGeometry({
        gridRef: scrollRef,
        cell: editing.editingCell,
        contentMetrics,
    });

    // Drop stale metrics when the edited cell changes. Without this the new
    // editor would be sized from the PREVIOUS cell's content for one frame,
    // which is visible as a flash at the wrong width.
    const lastEditedRef = useRef<string | null>(null);
    const editedKey = editing.editingCell
        ? `${editing.editingCell.row}:${editing.editingCell.col}`
        : null;
    if (lastEditedRef.current !== editedKey) {
        lastEditedRef.current = editedKey;
        if (contentMetrics !== null) setContentMetrics(null);
    }

    const isActive = (row: number, col: number) =>
        selection.activeCell?.row === row &&
        selection.activeCell?.col === col;

    const isEditing = (row: number, col: number) =>
        editing.editingCell?.row === row && editing.editingCell?.col === col;

    const beginEdit = (row: number, col: number, cellEditable: boolean) => {
        if (!cellEditable) return;
        const current = getCell(data, row, col);
        // Reported BEFORE the edit opens, so a caller can record what identifies
        // this row while it is still unambiguous. See `onEditBegin`: a (row, col)
        // pair stops meaning the same thing as soon as rows move.
        onEditBegin?.(row, col, data);
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
                    multiline={descriptor.multiline ?? multiline}
                    className={descriptor.className}
                    tooltip={descriptor.tooltip}
                    active={isActive(row, col)}
                    editing={isEditing(row, col)}
                    editable={cellEditable}
                    row={r}
                    col={c}
                    onSelect={() => {
                        selection.select({ row: r, col: c });
                        onCellClick?.(r, c, data);
                    }}
                    onBeginEdit={() => beginEdit(r, c, cellEditable)}
                />,
            );
        }
        rows.push(
            <Row
                // A STABLE key when the caller supplies one, so React follows
                // records rather than slots. Falls back to the index, which is
                // correct only while the row set cannot change.
                key={getRowKey ? getRowKey(data, row) : row}
                // `row + 1` is the row's VISIBLE POSITION, which is only the
                // right label when no rows are hidden. A caller that can hide
                // rows supplies its own stable numbering instead.
                header={
                    getColumnHeader
                        ? getRowHeader
                            ? getRowHeader(data, row)
                            : row + 1
                        : undefined
                }
            >
                {cells}
            </Row>,
        );
    }

    // Keep the active cell within bounds if the grid shrank.
    selection.reconcile(rowCount, colCount);

    // Stable identity so reporting metrics cannot itself trigger a re-measure
    // loop. The editor calls this after each draft change.
    const handleContentMetrics = useCallback((m: ContentMetrics) => {
        setContentMetrics((prev) =>
            prev &&
            prev.naturalWidth === m.naturalWidth &&
            prev.contentHeight === m.contentHeight
                ? prev
                : m,
        );
    }, []);

    // ---- Presentation flags for the edited cell ------------------------
    // Read from the descriptor of the cell being edited, so the floating editor
    // wraps and aligns the way that cell does. One extra `getCell` call while an
    // edit is open, not one per keystroke per cell.
    let editingCellMultiline = multiline;
    let editingCellAlign: "left" | "center" | "right" | undefined;
    // BOUNDS CHECK, not a nicety. The edited address is remembered in state,
    // so it outlives a change to the data: when rows or columns disappear while
    // an edit is open — a collapsed tree node, a filter, a deletion — this asked
    // `getCell` for a cell that no longer exists and threw inside the CALLER's
    // own accessor. `useEditing` cannot prevent it either, since it is deliberately
    // ignorant of the data.
    const editingInBounds =
        editing.editingCell !== null &&
        editing.editingCell.row < rowCount &&
        editing.editingCell.col < colCount;
    if (editing.editingCell && editingInBounds) {
        const d = getCell(
            data,
            editing.editingCell.row,
            editing.editingCell.col,
        );
        editingCellMultiline = d.multiline ?? multiline;
        editingCellAlign = d.align;
    }

    // An edit whose cell has vanished is abandoned rather than left floating
    // over nothing. Deferred to an effect because a setState during render is
    // illegal; the render below simply skips the overlay in the meantime.
    useEffect(() => {
        if (editing.editingCell && !editingInBounds) editing.cancel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingInBounds, editing.editingCell]);

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
                scrollRef={scrollRef}
                maxWidth={maxWidth}
                maxHeight={maxHeight}
                overlay={
                    // The floating layer. Rendered only while editing, so the
                    // grid pays nothing for it at rest.
                    editing.editingCell && editingInBounds && editorGeometry ? (
                        <CellEditor
                            geometry={editorGeometry}
                            // `key` remounts the editor when the edited cell
                            // changes, so its internal draft is reseeded
                            // instead of leaking from the previous cell.
                            key={`${editing.editingCell.row}:${editing.editingCell.col}`}
                            initialDraft={editing.initialDraft}
                            multiline={editingCellMultiline}
                            align={editingCellAlign}
                            onContentMetrics={handleContentMetrics}
                            onCommitEdit={editing.commit}
                            onCancelEdit={editing.cancel}
                        />
                    ) : undefined
                }
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
