// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
    SpreadsheetView,
    type CellDescriptor,
} from "../../src/views/spreadsheet-view";

afterEach(cleanup);

interface Ledger {
    rows: { id: number; date: string; amount: string }[];
}

const ledger: Ledger = {
    rows: [
        { id: 1, date: "2026-01-02", amount: "1000.00" },
        { id: 2, date: "2026-01-05", amount: "-84.20" },
    ],
};

/** The accessors every test needs; header props are added per test. */
const base = {
    data: ledger,
    getRowCount: (d: Ledger) => d.rows.length,
    getColumnCount: () => 2,
    getCell: (d: Ledger, row: number, col: number): CellDescriptor => ({
        value: col === 0 ? d.rows[row].date : d.rows[row].amount,
    }),
};

const COLUMN_LABELS = ["Date", "Amount"];

describe("column headers", () => {
    it("renders one header per column, in order", () => {
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
            />,
        );
        expect(
            screen.getAllByRole("columnheader").map((h) => h.textContent),
        ).toEqual(["Date", "Amount"]);
    });

    it("marks them as column headers with scope, not merely as cells", () => {
        // `scope="col"` is what associates a header with the column beneath it.
        // Without it the element is just a <th> that happens to sit on top, and a
        // screen reader cannot announce "Amount" while reading a cell below.
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
            />,
        );
        const scopes = screen
            .getAllByRole("columnheader")
            .map((h) => h.getAttribute("scope"));
        expect(scopes).toEqual(["col", "col"]);
    });

    it("omitting getColumnHeader renders no header strip", () => {
        // Absence of the accessor IS the switch, so there is no separate boolean
        // that could contradict it.
        render(<SpreadsheetView<Ledger> {...base} />);
        expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
    });

    it("still renders the data when there is no header strip", () => {
        render(<SpreadsheetView<Ledger> {...base} />);
        expect(
            screen.getAllByRole("gridcell").map((c) => c.textContent),
        ).toEqual(["2026-01-02", "1000.00", "2026-01-05", "-84.20"]);
    });

    it("asks for each column header exactly once", () => {
        const asked: number[] = [];
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => {
                    asked.push(col);
                    return COLUMN_LABELS[col];
                }}
            />,
        );
        expect(asked).toEqual([0, 1]);
    });

    it("passes the caller's data to the accessor", () => {
        // The header may depend on the data, e.g. a column count that varies.
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(d, col) =>
                    `${COLUMN_LABELS[col]} (${d.rows.length})`
                }
            />,
        );
        expect(
            screen.getAllByRole("columnheader").map((h) => h.textContent),
        ).toEqual(["Date (2)", "Amount (2)"]);
    });
});

describe("the gutter corner", () => {
    it("appears when both a header strip and a row gutter exist", () => {
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
                getRowHeader={(_d, row) => row + 1}
            />,
        );
        expect(
            document.querySelectorAll("thead th"),
        ).toHaveLength(3); // corner + two headers
    });

    it("does NOT appear without a row gutter", () => {
        // The corner exists only to fill the square above the gutter. Rendering it
        // anyway would offset every header by one column.
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
            />,
        );
        expect(document.querySelectorAll("thead th")).toHaveLength(2);
    });

    it("is hidden from assistive technology", () => {
        // It labels nothing. Announced as an empty header it would suggest the
        // gutter's row numbers have a blank name.
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
                getRowHeader={(_d, row) => row + 1}
            />,
        );
        // Three <th> in the head, but only two are exposed as column headers.
        expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    });

    it("carries no scope, so it labels neither a row nor a column", () => {
        render(
            <SpreadsheetView<Ledger>
                {...base}
                getColumnHeader={(_d, col) => COLUMN_LABELS[col]}
                getRowHeader={(_d, row) => row + 1}
            />,
        );
        const first = document.querySelectorAll("thead th")[0];
        expect(first.getAttribute("scope")).toBeNull();
    });
});
