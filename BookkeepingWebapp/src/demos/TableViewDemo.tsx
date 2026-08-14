import { useState } from "react";
import { TableView, type LayoutCell } from "../views/table-view";
import "./TableViewDemo.css";

/**
 * `TableView` on its own, with NO spreadsheet around it.
 *
 * The point of the demo is what is missing: there is no selection controller, no
 * editor and no viewport, because the view holds no behaviour. It draws a table
 * and reports gestures. Everything that looks interactive below is state in THIS
 * file, fed back in through `getCell`.
 *
 *   click a cell        -> `onCellSelect`      -> highlighted via `className`
 *   double-click        -> `onCellBeginEdit`   -> logged (no editor exists)
 *   drag across cells   -> `onCellPointerDown` / `onCellPointerEnter`
 *
 * A cell is highlighted by handing back a CLASS NAME, not by telling the view to
 * select something — the view has no notion of a selection to tell.
 */

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

export function TableViewDemo() {
    // The "selection" lives HERE, not in the view. One cell, deliberately
    // simple: a real range selection is what SpreadsheetView's layers add.
    const [picked, setPicked] = useState<{ row: number; col: number } | null>(
        null,
    );
    const [log, setLog] = useState<string[]>([]);
    const push = (line: string) =>
        setLog((prev) => [line, ...prev].slice(0, 6));

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640 }}>
            <h3>Table View Demo (drawing only, no behaviour)</h3>

            <TableView<LedgerState>
                data={INITIAL}
                getRowCount={(d) => d.rows.length}
                getColumnCount={() => COLUMNS.length}
                // Bound to the data by the caller: the view pulls (row, col) and
                // never receives a materialised array.
                getCell={(row, col): LayoutCell => {
                    const column = COLUMNS[col];
                    const isPicked = picked?.row === row && picked?.col === col;
                    return {
                        value: INITIAL.rows[row][column.key],
                        // Fully resolved — the view applies no defaults.
                        editable: column.key !== "date",
                        multiline: false,
                        align: column.align,
                        className: isPicked ? "cell--picked" : undefined,
                    };
                }}
                getRowKey={(row) => INITIAL.rows[row].id}
                getRowHeader={(row) => row + 1}
                getColumnHeader={(col) => COLUMNS[col].label}
                onCellSelect={(row, col) => {
                    setPicked({ row, col });
                    push(`onCellSelect(${row}, ${col})`);
                }}
                onCellBeginEdit={(row, col) =>
                    push(`onCellBeginEdit(${row}, ${col}) — no editor here`)
                }
                onCellPointerDown={(row, col, additive) =>
                    push(`onCellPointerDown(${row}, ${col}, additive=${additive})`)
                }
            />

            <div style={{ padding: "12px 4px", fontSize: 13 }}>
                <strong>Picked cell:</strong>{" "}
                {picked ? `(${picked.row}, ${picked.col})` : "none"}
            </div>

            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 8,
                    fontSize: 12,
                    minHeight: 60,
                }}
            >
                {log.map((l) => `${l}\n`).join("") || "(callback log)"}
            </pre>

            <p style={{ fontSize: 12, color: "#666", padding: "0 4px" }}>
                Click a cell to pick it, double-click to see the edit callback
                fire with nothing behind it. The highlight is this demo's own
                state handed back through <code>getCell</code>; the table itself
                knows nothing about selection, editing or scrolling.
            </p>
        </div>
    );
}
