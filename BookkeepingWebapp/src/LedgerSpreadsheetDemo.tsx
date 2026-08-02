import { useState } from "react";
import {
    SpreadsheetView,
    type CellDescriptor,
} from "./views/spreadsheet-view-old";

/**
 * An ARBITRARY business data structure for the spreadsheet. Like the tab bar,
 * SpreadsheetView never sees this shape — it reaches in via getCell / counts /
 * onCellEdit only. Here it happens to be a simple ledger of transactions.
 */
interface Txn {
    /**
     * A STABLE identity, minted once when the row is created and never reused.
     *
     * Not the row index. An index names a POSITION, so inserting or deleting
     * makes the same index refer to a different transaction — which silently
     * moves the selection onto another record, and can commit an edit to the
     * wrong one. Measured before this: selecting "b" then inserting at the top
     * left the selection showing "a".
     *
     * A counter rather than a UUID because this is a single-user app: nothing
     * mints ids in two places, and a short number stays readable in logs. See
     * `nextTxnId` for the reseeding rule that keeps it collision-free.
     */
    id: number;
    date: string;
    description: string;
    amount: number;
}

/**
 * Mint the next transaction id.
 *
 * Derived from `max(existing) + 1` rather than a module-level counter, because a
 * counter living in memory resets on reload while the saved data keeps its ids —
 * so the counter would re-mint numbers already in use. Measured: after a reset,
 * a fresh counter produced id 1, colliding with an existing row.
 */
function nextTxnId(rows: Txn[]): number {
    return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

interface LedgerState {
    columns: { label: string; align?: "left" | "right" }[];
    rows: Txn[];
}

export function DataDrivenSpreadsheetDemo() {
    const [ledger, setLedger] = useState<LedgerState>({
        columns: [
            { label: "Date" },
            { label: "Description" },
            { label: "Amount", align: "right" },
        ],
        rows: [
            { id: 1, date: "2026-01-03", description: "Opening balance", amount: 1000 },
            { id: 2, date: "2026-01-05", description: "Groceries", amount: -84.2 },
            {
                id: 3,
                date: "2026-01-09",
                description: "Salary\nmonthly, after tax",
                amount: 2500,
            },
            {
                id: 4,
                date: "2026-01-15",
                // Long on purpose: editing this is what walks the size ladder
                // from "fits the cell" all the way to "scrolls internally".
                description:
                    "Annual insurance premium, paid in full, covering both the "
                    + "office contents and the professional indemnity rider",
                amount: -1899.99,
            },
            { id: 5, date: "2026-01-18", description: "Coffee beans", amount: -42 },
            { id: 6, date: "2026-01-22", description: "Client invoice", amount: 3400 },
            { id: 7, date: "2026-01-12", description: "Electricity", amount: -120.5 },
        ],
    });
    const [log, setLog] = useState<string[]>([]);
    const pushLog = (msg: string) =>
        setLog((prev) => [msg, ...prev].slice(0, 6));

    /**
     * SELECTION, held by the host and addressed BY ID.
     *
     * The grid tracks selection as `{row, col}`, which is positional: insert a
     * row above the selected one and the selection silently lands on a different
     * transaction. Measured: selecting "b" then inserting at the top left the
     * selection showing "a".
     *
     * Storing the id here and converting to a row index at render time means the
     * selection follows the RECORD instead of the slot, with no fix-up step
     * after each insert or delete.
     */
    const [selectedId, setSelectedId] = useState<number | null>(1);
    const [selectedCol, setSelectedCol] = useState(0);

    // Viewport bounds, adjustable so the editor size ladder can be seen by hand.
    // Strings throughout, to exercise the relative-unit path as well as px.
    const [maxWidth, setMaxWidth] = useState("480px");
    const [maxHeight, setMaxHeight] = useState("150px");

    // ACCESS callbacks: random access into the business data. A grid asks only
    // for the cells it needs (which pairs with future virtualization).
    const getRowCount = (data: LedgerState) => data.rows.length;
    const getColumnCount = (data: LedgerState) => data.columns.length;
    const getColumnHeader = (data: LedgerState, col: number) =>
        data.columns[col].label;

    const getCell = (
        data: LedgerState,
        row: number,
        col: number,
    ): CellDescriptor => {
        const txn = data.rows[row];
        switch (col) {
            case 0:
                return { value: txn.date };
            case 1:
                // Only the description wraps. The date and amount stay
                // single-line so a stray newline cannot reach Number().
                return { value: txn.description, multiline: true };
            case 2:
                return {
                    value: txn.amount.toFixed(2),
                    align: "right",
                };
            default:
                return { value: "" };
        }
    };

    /** Row index of the selected id, or -1. Derived, never stored. */
    const selectedIndex = ledger.rows.findIndex((r) => r.id === selectedId);

    /**
     * INSERT relative to the selection. `offset` 0 inserts above, 1 below.
     *
     * Note what is NOT here: any adjustment of the stored selection. Because the
     * selection is an id, inserting cannot change what it refers to. With a
     * stored row index this function would also have to shift it, and every
     * other mutation would need its own matching rule.
     */
    const insertRow = (offset: number) => {
        setLedger((prev) => {
            const at =
                selectedIndex === -1
                    ? prev.rows.length
                    : selectedIndex + offset;
            const row: Txn = {
                id: nextTxnId(prev.rows),
                date: "2026-02-01",
                description: "New entry",
                amount: 0,
            };
            pushLog(`insert id ${row.id} at index ${at}`);
            const rows = [...prev.rows];
            rows.splice(at, 0, row);
            return { ...prev, rows };
        });
    };

    /** DELETE the selected row, moving the selection to a surviving neighbour. */
    const deleteRow = () => {
        if (selectedIndex === -1) return;
        setLedger((prev) => {
            const rows = prev.rows.filter((r) => r.id !== selectedId);
            pushLog(`delete id ${selectedId}`);
            // The deleted id can no longer be selected, so pick a neighbour by
            // ID. Choosing an INDEX here would reintroduce exactly the problem
            // ids are here to avoid.
            const next =
                rows[Math.min(selectedIndex, rows.length - 1)] ?? null;
            setSelectedId(next ? next.id : null);
            return { ...prev, rows };
        });
    };

    // MUTATE callback: apply a committed edit to the business data structure.
    /**
     * The id of the row whose edit is in progress, captured when it began.
     *
     * `onCellEdit` reports a row INDEX, and an index can mean a different
     * transaction by the time the edit commits — insert a row above an open
     * editor and the reported index now names its neighbour. Comparing against
     * the id captured at the start is what stops the value landing on the wrong
     * transaction.
     */
    const [editingId, setEditingId] = useState<number | null>(null);

    const handleCellEdit = (
        row: number,
        col: number,
        value: string,
        data: LedgerState,
    ) => {
        const target = data.rows[row];
        // If the row now holds a different transaction than when editing
        // started, the address is stale: discard rather than overwrite an
        // unrelated record.
        if (editingId !== null && target?.id !== editingId) {
            pushLog(`discarded stale edit (id ${editingId})`);
            setEditingId(null);
            return;
        }
        setEditingId(null);
        if (!target) return;

        pushLog(`edit id ${target.id} col ${col} = "${value}"`);
        setLedger(() => {
            // Applied BY ID, not by index, so the write cannot drift even if the
            // row order changed between opening the editor and committing.
            const rows = data.rows.map((r) => {
                if (r.id !== target.id) return r;
                const txn = { ...r };
                if (col === 0) txn.date = value;
                else if (col === 1) txn.description = value;
                else if (col === 2) {
                    const n = Number(value);
                    if (!Number.isNaN(n)) txn.amount = n;
                }
                return txn;
            });
            return { ...data, rows };
        });
    };

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640, marginTop: 32 }}>
            <h3>Data-driven SpreadsheetView demo</h3>

            {/*
             * A deliberately SMALL viewport, and adjustable, because the editor
             * only grows as far as the visible region allows. With a viewport
             * larger than the content you can never reach the interesting rungs
             * of the ladder by hand — the box always has room and never wraps.
             */}
            <div style={{ display: "flex", gap: 12, padding: "0 4px 12px" }}>
                <label style={{ fontSize: 12 }}>
                    max width{" "}
                    <select
                        value={maxWidth}
                        onChange={(e) => setMaxWidth(e.target.value)}
                    >
                        <option value="320px">320px</option>
                        <option value="480px">480px</option>
                        <option value="50%">50%</option>
                        <option value="100%">100%</option>
                    </select>
                </label>
                <label style={{ fontSize: 12 }}>
                    max height{" "}
                    <select
                        value={maxHeight}
                        onChange={(e) => setMaxHeight(e.target.value)}
                    >
                        <option value="90px">90px</option>
                        <option value="150px">150px</option>
                        <option value="30vh">30vh</option>
                        <option value="480px">480px</option>
                    </select>
                </label>
            </div>

            {/*
              * CRUD relative to the SELECTION. All three act on the selected
              * transaction, which is tracked by id, so none of them needs to
              * fix up any stored position afterwards.
              */}
            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
                <button
                    type="button"
                    onClick={() => insertRow(0)}
                    disabled={selectedIndex === -1}
                >
                    insert above
                </button>
                <button
                    type="button"
                    onClick={() => insertRow(1)}
                    disabled={selectedIndex === -1}
                >
                    insert below
                </button>
                <button
                    type="button"
                    onClick={deleteRow}
                    disabled={selectedIndex === -1}
                >
                    delete row
                </button>
                <span style={{ fontSize: 12, color: "#666" }}>
                    selected id: {selectedId ?? "none"} (row{" "}
                    {selectedIndex === -1 ? "-" : selectedIndex})
                </span>
            </div>

            <SpreadsheetView<LedgerState>
                data={ledger}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={getCell}
                getColumnHeader={getColumnHeader}
                onCellEdit={handleCellEdit}
                // STABLE KEYS: React follows records rather than slots, so an
                // open editor or focus stays with its transaction across an
                // insert instead of being inherited by whatever moved into that
                // position.
                getRowKey={(d, row) => d.rows[row].id}
                // CONTROLLED SELECTION, converted from id to index at render
                // time. The grid still speaks positions; the host speaks ids.
                activeCell={
                    selectedIndex === -1
                        ? null
                        : { row: selectedIndex, col: selectedCol }
                }
                // Controlled selection is read-only in the grid today, so the
                // click has to be applied here. Translate the reported row back
                // into an id immediately, while the index is still valid.
                onCellClick={(r, c, d) => {
                    setSelectedId(d.rows[r].id);
                    setSelectedCol(c);
                    pushLog(`select id ${d.rows[r].id} col ${c}`);
                }}
                // Capture the row IDENTITY while the index is still valid.
                onEditBegin={(row, _col, d) =>
                    setEditingId(d.rows[row]?.id ?? null)
                }
                editable
                maxWidth={maxWidth}
                maxHeight={maxHeight}
            />
            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 8,
                    fontSize: 12,
                    minHeight: 70,
                }}
            >
                {log.map((l) => `${l}\n`).join("") || "(interaction log)"}
            </pre>
            <p style={{ fontSize: 12, color: "#666" }}>
                Click a cell to select; arrow keys navigate; Enter/F2 or
                double-click edits; Enter commits, Esc cancels. The
                Description column is multiline: Alt+Enter inserts a line
                break at the caret.
            </p>
            <p style={{ fontSize: 12, color: "#666" }}>
                To watch the editor size ladder, edit the long Description on
                2026-01-15 with max width 320px: the box first grows sideways
                over the Amount column, then stops at the viewport edge and
                wraps downward, then stops at the bottom and scrolls. Shrinking
                max height to 90px reaches the scrolling rung sooner.
            </p>
        </div>
    );
}

