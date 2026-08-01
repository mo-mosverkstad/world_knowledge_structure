// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HierarchicalLedgerDemo } from "../src/HierarchicalLedgerDemo";

afterEach(cleanup);

/**
 * Tests for the hierarchy CUSTOMISATION.
 *
 * The point they establish is architectural: a tree can be presented through the
 * flat `SpreadsheetView` with no changes to that component, because its contract
 * is a pair of operations (`getRowCount`, `getCell`) rather than a data shape.
 * The tree, the flattening and the expand state all live in the caller.
 */

/** Every cell in the Account column, in visible order. */
const labels = () =>
    screen
        .getAllByRole("gridcell")
        .filter((_, i) => i % 3 === 1)
        .map((c) => c.textContent);

/** The Amount column. */
const amounts = () =>
    screen
        .getAllByRole("gridcell")
        .filter((_, i) => i % 3 === 2)
        .map((c) => c.textContent);

const labelCell = (text: string) =>
    screen
        .getAllByRole("gridcell")
        .filter((_, i) => i % 3 === 1)
        .find((c) => c.textContent === text)!;

/** The twisty button on the row whose label is `text`, if any. */
const twistyFor = (text: string) => {
    const cells = screen.getAllByRole("gridcell");
    const index = cells.findIndex(
        (c, i) => i % 3 === 1 && c.textContent === text,
    );
    // Column 0 of the same row.
    return cells[index - 1].querySelector("button");
};

describe("hierarchy needs no grid changes", () => {
    it("renders only the visible rows of the tree", () => {
        render(<HierarchicalLedgerDemo />);
        // "/0" and "/0/0" open initially: Assets and Cash are expanded,
        // Receivables and Liabilities are not.
        expect(labels()).toEqual([
            "Assets",
            "Cash",
            "Checking",
            "Savings",
            "Receivables",
            "Liabilities",
            "Opening balance",
        ]);
    });

    it("expands a node by adding its children to the row list", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(twistyFor("Receivables")!);
        expect(labels()).toEqual([
            "Assets",
            "Cash",
            "Checking",
            "Savings",
            "Receivables",
            "Invoice 41",
            "Invoice 42",
            "Liabilities",
            "Opening balance",
        ]);
    });

    it("collapses a node by removing its whole subtree", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(twistyFor("Assets")!);
        // Cash, Checking, Savings and Receivables all disappear together.
        expect(labels()).toEqual([
            "Assets",
            "Liabilities",
            "Opening balance",
        ]);
    });

    it("expand all / collapse all work over the whole tree", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));
        expect(labels()).toEqual([
            "Assets",
            "Cash",
            "Checking",
            "Savings",
            "Receivables",
            "Invoice 41",
            "Invoice 42",
            "Liabilities",
            "Credit card",
            "Loan",
            "Opening balance",
        ]);

        fireEvent.click(screen.getByText("collapse all"));
        expect(labels()).toEqual([
            "Assets",
            "Liabilities",
            "Opening balance",
        ]);
    });

    it("shows depth as a class, which is what keeps labels editable", () => {
        // Indentation must not be markup wrapped around the text: the grid seeds
        // its editor with `String(value)`, so a React element would give
        // "[object Object]". A class shifts the text without touching the value.
        render(<HierarchicalLedgerDemo />);
        const depths = screen
            .getAllByRole("gridcell")
            .filter((_, i) => i % 3 === 1)
            .map((c) => (c.className.match(/depth-\d/) ?? ["none"])[0]);
        expect(depths).toEqual([
            "depth-0", // Assets
            "depth-1", // Cash
            "depth-2", // Checking
            "depth-2", // Savings
            "depth-1", // Receivables
            "depth-0", // Liabilities
            "depth-0", // Opening balance
        ]);
    });

    it("only expandable rows get a twisty", () => {
        render(<HierarchicalLedgerDemo />);
        expect(twistyFor("Assets")).not.toBeNull();
        expect(twistyFor("Cash")).not.toBeNull();
        expect(twistyFor("Checking")).toBeNull();
        expect(twistyFor("Opening balance")).toBeNull();
    });
});

describe("row numbering is stable across collapse", () => {
    /**
     * The grid labels its gutter `row + 1` by default — the row's VISIBLE
     * POSITION. For a flat sheet that is right. For a tree it is wrong: hiding
     * rows renumbers every row below, so rows appear to move when they have not.
     * Measured before the fix: "Liabilities" was row 8 expanded and row 2
     * collapsed.
     *
     * The fix is two-part: the grid accepts a `getRowHeader` callback, and this
     * demo numbers nodes over the WHOLE tree so collapsing hides numbers rather
     * than reshuffling them.
     */
    const numbers = () =>
        screen.getAllByRole("rowheader").map((h) => h.textContent);

    const numberOf = (label: string) => {
        const i = labels().indexOf(label);
        return i === -1 ? null : numbers()[i];
    };

    it("numbers every node consecutively when fully expanded", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));
        expect(numbers()).toEqual([
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
        ]);
    });

    it("SKIPS the numbers of hidden rows instead of renumbering", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));

        // Collapsing Cash hides Checking (3) and Savings (4).
        fireEvent.click(twistyFor("Cash")!);
        expect(numbers()).toEqual([
            "1", "2", "5", "6", "7", "8", "9", "10", "11",
        ]);
    });

    it("keeps skipping as more nodes collapse", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));
        fireEvent.click(twistyFor("Cash")!);
        fireEvent.click(twistyFor("Receivables")!);
        expect(numbers()).toEqual(["1", "2", "5", "8", "9", "10", "11"]);
    });

    it("collapsing a whole subtree hides its numbers together", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));
        fireEvent.click(twistyFor("Assets")!);
        // 2..7 all belong to the Assets subtree.
        expect(numbers()).toEqual(["1", "8", "9", "10", "11"]);
    });

    it("a row keeps ITS OWN number regardless of what is collapsed", () => {
        // The property that matters: the number identifies the row, it does not
        // count the rows currently on screen.
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("expand all"));
        expect(numberOf("Liabilities")).toBe("8");

        fireEvent.click(twistyFor("Assets")!);
        expect(numberOf("Liabilities")).toBe("8");

        fireEvent.click(screen.getByText("collapse all"));
        expect(numberOf("Liabilities")).toBe("8");
    });

    it("counts hidden descendants at every depth, not just one level", () => {
        // "Opening balance" is last, so its number is the total node count. If
        // hidden grandchildren were not counted it would come out too low.
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(screen.getByText("collapse all"));
        expect(numberOf("Opening balance")).toBe("11");
    });
});

describe("editing survives the hierarchy", () => {
    const editorEl = () =>
        document.querySelector("textarea.cell-editor") as HTMLTextAreaElement | null;

    it("seeds the editor with the label, not '[object Object]'", () => {
        // The trap this whole design avoids. A rich cell value would produce
        // "[object Object]" here.
        render(<HierarchicalLedgerDemo />);
        fireEvent.doubleClick(labelCell("Savings"));
        expect(editorEl()?.value).toBe("Savings");
    });

    it("renames a NESTED node, addressed by path rather than row index", () => {
        render(<HierarchicalLedgerDemo />);
        fireEvent.doubleClick(labelCell("Checking"));
        fireEvent.change(editorEl()!, { target: { value: "Current account" } });
        fireEvent.keyDown(editorEl()!, { key: "Enter" });

        expect(labels()).toContain("Current account");
        expect(labels()).not.toContain("Checking");
    });

    it("renames the right node after the row indices have shifted", () => {
        // The reason edits are applied by PATH: expanding a node above changes
        // every row index below it, so a row index is not a stable address.
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(twistyFor("Receivables")!); // shifts Liabilities down

        fireEvent.doubleClick(labelCell("Liabilities"));
        fireEvent.change(editorEl()!, { target: { value: "Debts" } });
        fireEvent.keyDown(editorEl()!, { key: "Enter" });

        expect(labels()).toContain("Debts");
        // Nothing else was disturbed.
        expect(labels()).toContain("Invoice 41");
        expect(labels()).toContain("Assets");
    });

    it("edits a leaf amount and the parent subtotal follows", () => {
        render(<HierarchicalLedgerDemo />);
        // Checking 1200 + Savings 8400 = 9600 under Cash.
        expect(amounts()).toContain("9600.00");

        const cells = screen.getAllByRole("gridcell");
        const idx = cells.findIndex(
            (c, i) => i % 3 === 1 && c.textContent === "Checking",
        );
        fireEvent.doubleClick(cells[idx + 1]); // its Amount cell
        fireEvent.change(editorEl()!, { target: { value: "1300" } });
        fireEvent.keyDown(editorEl()!, { key: "Enter" });

        // 1300 + 8400 = 9700, and Assets rolls up too.
        expect(amounts()).toContain("9700.00");
    });

    it("keeps parent subtotals read-only", () => {
        // Editing a computed value is meaningless, so those cells opt out.
        render(<HierarchicalLedgerDemo />);
        const cells = screen.getAllByRole("gridcell");
        const idx = cells.findIndex(
            (c, i) => i % 3 === 1 && c.textContent === "Cash",
        );
        fireEvent.doubleClick(cells[idx + 1]);
        expect(editorEl()).toBeNull();
    });

    it("does not begin an edit when the twisty is clicked", () => {
        // The twisty stops propagation, so toggling never doubles as a select.
        render(<HierarchicalLedgerDemo />);
        fireEvent.click(twistyFor("Assets")!);
        expect(editorEl()).toBeNull();
    });

    it("survives collapsing the subtree containing the edited cell", () => {
        // The case the first version of these tests missed, and the one that
        // crashed in a real browser: collapsing removes rows, so the remembered
        // edit address can fall outside the data. The grid used to ask `getCell`
        // for the vanished row, and the exception surfaced inside the DEMO's own
        // accessor as "Cannot read properties of undefined (reading 'account')".
        render(<HierarchicalLedgerDemo />);

        fireEvent.doubleClick(labelCell("Savings"));
        expect(editorEl()).not.toBeNull();

        // Collapse Assets, removing Savings along with the whole subtree.
        expect(() => fireEvent.click(twistyFor("Assets")!)).not.toThrow();

        // The edit is abandoned, not left floating over a row that is gone.
        expect(editorEl()).toBeNull();
        expect(labels()).toEqual(["Assets", "Liabilities", "Opening balance"]);
    });

    it("survives collapse all while editing", () => {
        // The exact reproduction from the browser report.
        render(<HierarchicalLedgerDemo />);
        fireEvent.doubleClick(labelCell("Checking"));
        expect(editorEl()).not.toBeNull();

        expect(() =>
            fireEvent.click(screen.getByText("collapse all")),
        ).not.toThrow();
        expect(editorEl()).toBeNull();
    });
});
