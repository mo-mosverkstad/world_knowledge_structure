import { useSyncExternalStore } from "react";
import {
    SpreadsheetView,
    useSelectionController,
    type CellDescriptor,
} from "../views/spreadsheet-view";

interface Txn {
    id: number;
    date: string;
    description: string;
    amount: string;
}

interface LedgerState {
    rows: Txn[];
}

const COLUMNS: {
    key: keyof Omit<Txn, "id">;
    label: string;
    align?: "right";
}[] = [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount", align: "right" },
];

const INITIAL: LedgerState = {
    rows: [
        { id: 1, date: "2026-01-02", description: "Opening balance", amount: "1000.00" },
        { id: 2, date: "2026-01-05", description: "Groceries", amount: "-84.20" },
        { id: 3, date: "2026-01-06", description: "Salary", amount: "2400.00" },
        { id: 4, date: "2026-01-09", description: "Rent", amount: "-950.00" },
        { id: 5, date: "2026-01-11", description: "Utilities", amount: "-120.55" },
        { id: 6, date: "2026-01-14", description: "Client invoice", amount: "1750.00" },
        { id: 7, date: "2026-01-18", description: "Fuel", amount: "-62.40" },
        { id: 8, date: "2026-01-22", description: "Insurance", amount: "-210.00" },
    ],
};

export function SpreadsheetViewDemo() {
    const selection = useSelectionController();

    // Subscribing here is what updates the readout below — and is why THIS
    // component re-renders on selection change while the table does not.
    const snapshot = useSyncExternalStore(
        selection.subscribe,
        selection.getSnapshot,
    );
    const active = snapshot.activeCell;

    const lastRow = INITIAL.rows.length - 1;
    const lastCol = COLUMNS.length - 1;

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640 }}>
            <h3>Spreadsheet View Demo</h3>
            <SpreadsheetView<LedgerState>
                data={INITIAL}
                getRowCount={(d) => d.rows.length}
                getColumnCount={() => COLUMNS.length}
                getCell={(d, row, col): CellDescriptor => ({
                    value: d.rows[row][COLUMNS[col].key],
                    align: COLUMNS[col].align,
                })}
                getColumnHeader={(_d, col) => COLUMNS[col].label}
                getRowHeader={(_d, row) => row + 1}
                getRowKey={(d, row) => d.rows[row].id}
                selectionController={selection}
                editable
                viewportWidth="100%"
                viewportHeight={220}
            />

            <div style={{ padding: "12px 4px", fontSize: 13 }}>
                <strong>Selection:</strong> {snapshot.ranges.length} range(s),{" "}
                {selection.countCells()} cell(s)
                {active ? ` — active (${active.row}, ${active.col})` : " — none"}
                {snapshot.dragging ? " [dragging]" : ""}
            </div>

            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
                {/* The host owns the controller, so these bypass the component. */}
                <button
                    type="button"
                    onClick={() =>
                        selection.selectRange({ row: 0, col: 0 }, { row: lastRow, col: lastCol })
                    }
                >
                    select all
                </button>
                <button
                    type="button"
                    onClick={() =>
                        selection.selectRange({ row: 0, col: 2 }, { row: lastRow, col: 2 })
                    }
                >
                    select amount column
                </button>
                <button type="button" onClick={() => selection.clear()}>
                    clear
                </button>
            </div>

            <p style={{ fontSize: 12, color: "#666", padding: "0 4px" }}>
                Drag to select a range; Ctrl/Cmd+click adds another. The table is
                not re-rendered while selecting.
            </p>
        </div>
    );
}
