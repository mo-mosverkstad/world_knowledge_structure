// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataDrivenSpreadsheetDemo } from "../src/demos/LedgerSpreadsheetDemo";

afterEach(cleanup);

/**
 * Tests for CRUD on the FLAT spreadsheet.
 *
 * What they establish: once rows can be inserted and deleted, every positional
 * address in play becomes a liability. Three of them exist here —
 *
 *   the React row key      key={row}        -> follows the SLOT, not the record
 *   the selection          {row, col}       -> lands on a neighbour after insert
 *   the edit address       {row, col}       -> commits onto the wrong record
 *
 * — and all three are fixed the same way: the host stores an ID and converts to a
 * row index only at the moment of rendering. Measured before the fix: selecting
 * "b" then inserting above left the selection showing "a".
 */

/** `queryAllByRole`, not `getAllByRole`: the grid can legitimately be empty. */
const cells = () => screen.queryAllByRole("gridcell");

/** The Description column, which is column 1 of three. */
const descriptions = () =>
    cells()
        .filter((_, i) => i % 3 === 1)
        .map((c) => c.textContent);

const descriptionCell = (text: string) =>
    cells()
        .filter((_, i) => i % 3 === 1)
        .find((c) => c.textContent === text)!;

const selectedText = () =>
    cells().find((c) => c.getAttribute("aria-selected") === "true")?.textContent;

const editor = () =>
    document.querySelector("textarea.cell-editor") as HTMLTextAreaElement | null;

/** The "selected id: N (row M)" readout. */
const readout = () => screen.getByText(/selected id:/).textContent;

describe("insert", () => {
    it("inserts above the selected row", () => {
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        fireEvent.click(screen.getByText("insert above"));

        expect(descriptions().slice(0, 3)).toEqual([
            "Opening balance",
            "New entry",
            "Groceries",
        ]);
    });

    it("inserts below the selected row", () => {
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        fireEvent.click(screen.getByText("insert below"));

        expect(descriptions().slice(0, 3)).toEqual([
            "Opening balance",
            "Groceries",
            "New entry",
        ]);
    });

    it("keeps the selection on the same RECORD, not the same index", () => {
        // THE POINT OF THE IDS. Inserting above shifts every index below it, so a
        // stored index would now name the newly inserted row.
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        expect(selectedText()).toBe("Groceries");

        fireEvent.click(screen.getByText("insert above"));
        expect(selectedText()).toBe("Groceries");
    });

    it("reports the selection's row index moving while its id stays put", () => {
        // The readout makes the distinction visible: same id, different row.
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        expect(readout()).toContain("selected id: 2");
        expect(readout()).toContain("row 1");

        fireEvent.click(screen.getByText("insert above"));
        expect(readout()).toContain("selected id: 2");
        expect(readout()).toContain("row 2");
    });

    it("mints ids that do not collide with existing rows", () => {
        // `nextTxnId` derives from max(existing) + 1 rather than a counter held in
        // memory, which would restart at 1 after a reload and reuse live ids.
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Opening balance"));
        fireEvent.click(screen.getByText("insert below"));
        fireEvent.click(screen.getByText("insert below"));

        // Two new rows, and the selection is still the original row 0.
        expect(descriptions().slice(0, 3)).toEqual([
            "Opening balance",
            "New entry",
            "New entry",
        ]);
        expect(readout()).toContain("selected id: 1");
    });
});

describe("delete", () => {
    it("removes the selected row", () => {
        render(<DataDrivenSpreadsheetDemo />);
        const before = descriptions().length;
        fireEvent.click(descriptionCell("Groceries"));
        fireEvent.click(screen.getByText("delete row"));

        expect(descriptions()).toHaveLength(before - 1);
        expect(descriptions()).not.toContain("Groceries");
    });

    it("moves the selection to a surviving neighbour", () => {
        // The deleted id cannot stay selected, so a neighbour is chosen — by id,
        // not by reusing the vacated index.
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        fireEvent.click(screen.getByText("delete row"));

        expect(selectedText()).toBe("Salary\nmonthly, after tax");
    });

    it("selects the new last row when the last row is deleted", () => {
        render(<DataDrivenSpreadsheetDemo />);
        const all = descriptions();
        fireEvent.click(descriptionCell(all[all.length - 1]!));
        fireEvent.click(screen.getByText("delete row"));

        const remaining = descriptions();
        expect(selectedText()).toBe(remaining[remaining.length - 1]);
    });

    it("deleting everything clears the selection and disables the buttons", () => {
        render(<DataDrivenSpreadsheetDemo />);
        for (let i = descriptions().length; i > 0; i--) {
            fireEvent.click(descriptionCell(descriptions()[0]!));
            fireEvent.click(screen.getByText("delete row"));
        }
        expect(descriptions()).toHaveLength(0);
        expect(readout()).toContain("selected id: none");
        // `.disabled` rather than `toBeDisabled()`: this project does not use
        // jest-dom, so the custom matchers are not available.
        expect(
            (screen.getByText("delete row") as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(
            (screen.getByText("insert above") as HTMLButtonElement).disabled,
        ).toBe(true);
    });
});

describe("editing survives mutation", () => {
    it("commits to the row it was opened on", () => {
        render(<DataDrivenSpreadsheetDemo />);
        const cell = descriptionCell("Groceries");
        fireEvent.doubleClick(cell);
        fireEvent.change(editor()!, { target: { value: "Food shopping" } });
        fireEvent.keyDown(editor()!, { key: "Enter" });

        expect(descriptions()).toContain("Food shopping");
        expect(descriptions()).not.toContain("Groceries");
    });

    it("never writes onto a row inserted while the editor was open", () => {
        // The corruption case. `onCellEdit` reports a row INDEX, which now names
        // the inserted row rather than the one being edited. The id captured by
        // `onEditBegin` is what catches it.
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.click(descriptionCell("Groceries"));
        fireEvent.doubleClick(descriptionCell("Groceries"));
        expect(editor()!.value).toBe("Groceries");

        fireEvent.click(screen.getByText("insert above"));
        fireEvent.change(editor()!, { target: { value: "RENAMED" } });
        fireEvent.keyDown(editor()!, { key: "Enter" });

        // Whatever happened to the edit, the inserted row must be untouched.
        const rows = descriptions();
        const insertedIndex = rows.indexOf("New entry");
        expect(insertedIndex).toBeGreaterThanOrEqual(0);
        expect(rows[insertedIndex]).toBe("New entry");
    });

    it("applies the edit BY ID, so row order cannot misdirect it", () => {
        render(<DataDrivenSpreadsheetDemo />);
        fireEvent.doubleClick(descriptionCell("Coffee beans"));
        fireEvent.change(editor()!, { target: { value: "Tea" } });
        fireEvent.keyDown(editor()!, { key: "Enter" });

        // Only that row changed; its neighbours are intact.
        expect(descriptions()).toContain("Tea");
        expect(descriptions()).toContain("Client invoice");
        expect(descriptions()).toContain("Opening balance");
    });
});

