import { SpreadsheetView, type CellDescriptor } from "../views/spreadsheet-view";

/** One transaction. `id` is what makes a row addressable as a record. */
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
    ],
};

export function SpreadsheetViewDemo() {
    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640 }}>
            <h3>Spreadsheet View Demo</h3>
            <SpreadsheetView<LedgerState>
                data={INITIAL}
                getRowCount={(d) => d.rows.length}
                getColumnCount={() => COLUMNS.length}
                getCell={(d, row, col): CellDescriptor => {
                    const column = COLUMNS[col];
                    return {
                        value: d.rows[row][column.key],
                        align: column.align,
                    };
                }}
                // Column names in the frozen header strip.
                getColumnHeader={(_d, col) => COLUMNS[col].label}
                // 1-based row numbers in the gutter.
                getRowHeader={(_d, row) => row + 1}
                // Stable keys, so React follows records rather than positions.
                getRowKey={(d, row) => d.rows[row].id}
            />
        </div>
    );
}
