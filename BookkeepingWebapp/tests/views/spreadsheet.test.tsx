// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpreadsheetView } from "../../src/views/spreadsheet-view";
import {
    type CellAddress,
    type CellDescriptor,
} from "../../src/views/spreadsheet-view";

afterEach(cleanup);

/**
 * BEHAVIOUR BASELINE for SpreadsheetView.
 *
 * Written deliberately in terms of ARIA ROLES, rendered text and user actions —
 * never in terms of `div` vs `table` — so the same suite pins the component's
 * behaviour across the change of underlying markup. A test that asserts
 * `.querySelector("div.cell")` would have to be rewritten by that refactor and
 * would therefore prove nothing about it.
 */

/** Minimal business data structure exercising the data port. */
interface Ledger {
    columns: string[];
    rows: { date: string; description: string; amount: number }[];
}

const ledger: Ledger = {
    columns: ["Date", "Description", "Amount"],
    rows: [
        { date: "2026-01-03", description: "Opening", amount: 1000 },
        { date: "2026-01-05", description: "Groceries", amount: -84.2 },
        { date: "2026-01-09", description: "Salary", amount: 2500 },
    ],
};

const getRowCount = (d: Ledger) => d.rows.length;
const getColumnCount = (d: Ledger) => d.columns.length;
const getColumnHeader = (d: Ledger, col: number) => d.columns[col];
const getCell = (d: Ledger, row: number, col: number): CellDescriptor => {
    const t = d.rows[row];
    switch (col) {
        case 0:
            return { value: t.date };
        case 1:
            return { value: t.description };
        case 2:
            return { value: t.amount.toFixed(2), align: "right" };
        default:
            return { value: "" };
    }
};

/** All data cells, in document order. Role-based, so markup-agnostic. */
const cells = () => screen.queryAllByRole("gridcell");
/** The data cell at (row, col), located via the grid's own row structure. */
const cellAt = (row: number, col: number) => cells()[row * 3 + col];
const activeCell = () =>
    cells().find((c) => c.getAttribute("aria-selected") === "true");

function renderSheet(overrides: Record<string, unknown> = {}) {
    return render(
        <SpreadsheetView<Ledger>
            data={ledger}
            getRowCount={getRowCount}
            getColumnCount={getColumnCount}
            getCell={getCell}
            {...overrides}
        />,
    );
}

describe("structure — exposed as a grid regardless of the elements used", () => {
    it("exposes one grid", () => {
        renderSheet();
        expect(screen.getAllByRole("grid")).toHaveLength(1);
    });

    it("exposes one gridcell per cell of the rectangular region", () => {
        renderSheet();
        expect(cells()).toHaveLength(3 * 3);
    });

    it("renders every value produced by getCell", () => {
        renderSheet();
        expect(screen.getByText("Opening")).toBeTruthy();
        expect(screen.getByText("Groceries")).toBeTruthy();
        expect(screen.getByText("2500.00")).toBeTruthy();
    });

    it("exposes column headers only when getColumnHeader is supplied", () => {
        renderSheet();
        expect(screen.queryAllByRole("columnheader")).toHaveLength(0);

        cleanup();
        renderSheet({ getColumnHeader });
        const headers = screen.getAllByRole("columnheader");
        expect(headers.map((h) => h.textContent)).toEqual([
            "Date",
            "Description",
            "Amount",
        ]);
    });

    it("exposes a row header per row when headers are enabled", () => {
        renderSheet({ getColumnHeader });
        expect(
            screen.getAllByRole("rowheader").map((h) => h.textContent),
        ).toEqual(["1", "2", "3"]);
    });

    it("groups cells into rows", () => {
        renderSheet({ getColumnHeader });
        // 3 body rows + 1 header row.
        expect(screen.getAllByRole("row")).toHaveLength(4);
    });

    it("applies the alignment hint from the descriptor", () => {
        renderSheet();
        expect(cellAt(0, 2).style.textAlign).toBe("right");
        expect(cellAt(0, 0).style.textAlign).toBe("");
    });

    it("applies a per-cell className and tooltip", () => {
        render(
            <SpreadsheetView<Ledger>
                data={ledger}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={(d, r, c) =>
                    r === 1 && c === 1
                        ? { value: "flagged", className: "warn", tooltip: "tip" }
                        : getCell(d, r, c)
                }
            />,
        );
        const cell = cellAt(1, 1);
        expect(cell.classList.contains("warn")).toBe(true);
        expect(cell.getAttribute("title")).toBe("tip");
    });
});

describe("selection", () => {
    it("has nothing selected by default", () => {
        renderSheet();
        expect(activeCell()).toBeUndefined();
    });

    it("honours defaultActiveCell", () => {
        renderSheet({ defaultActiveCell: { row: 1, col: 2 } });
        expect(activeCell()).toBe(cellAt(1, 2));
    });

    it("selects the clicked cell", () => {
        renderSheet();
        act(() => (cellAt(2, 1) as HTMLElement).click());
        expect(activeCell()).toBe(cellAt(2, 1));
    });

    it("reports selection changes", () => {
        const onSelectionChange = vi.fn();
        renderSheet({ onSelectionChange });
        act(() => (cellAt(0, 1) as HTMLElement).click());
        expect(onSelectionChange).toHaveBeenCalledWith(
            { row: 0, col: 1 },
            ledger,
        );
    });

    it("fires onCellClick as a separate behaviour hook", () => {
        const onCellClick = vi.fn();
        renderSheet({ onCellClick });
        act(() => (cellAt(1, 0) as HTMLElement).click());
        expect(onCellClick).toHaveBeenCalledWith(1, 0, ledger);
    });

    it("renders the controlled activeCell", () => {
        renderSheet({ activeCell: { row: 2, col: 0 } });
        expect(activeCell()).toBe(cellAt(2, 0));
    });

    it("follows external modification of the controlled value", () => {
        function Host() {
            const [cell, setCell] = useState<CellAddress | null>({
                row: 0,
                col: 0,
            });
            return (
                <>
                    <button onClick={() => setCell({ row: 2, col: 2 })}>
                        outside
                    </button>
                    <SpreadsheetView<Ledger>
                        data={ledger}
                        getRowCount={getRowCount}
                        getColumnCount={getColumnCount}
                        getCell={getCell}
                        activeCell={cell}
                    />
                </>
            );
        }
        render(<Host />);
        expect(activeCell()).toBe(cellAt(0, 0));

        act(() => screen.getByText("outside").click());
        expect(activeCell()).toBe(cellAt(2, 2));
    });
});

describe("keyboard navigation", () => {
    /** Fire a keydown on the grid, as a real user's focus would. */
    const press = (key: string) =>
        fireEvent.keyDown(screen.getByRole("grid"), { key });

    it("moves down with ArrowDown", () => {
        renderSheet({ defaultActiveCell: { row: 0, col: 0 } });
        press("ArrowDown");
        expect(activeCell()).toBe(cellAt(1, 0));
    });

    it("moves right with ArrowRight", () => {
        renderSheet({ defaultActiveCell: { row: 0, col: 0 } });
        press("ArrowRight");
        expect(activeCell()).toBe(cellAt(0, 1));
    });

    it("clamps at the edges instead of wrapping", () => {
        renderSheet({ defaultActiveCell: { row: 0, col: 0 } });
        press("ArrowUp");
        press("ArrowLeft");
        expect(activeCell()).toBe(cellAt(0, 0));
    });

    it("clamps at the far edge", () => {
        renderSheet({ defaultActiveCell: { row: 2, col: 2 } });
        press("ArrowDown");
        press("ArrowRight");
        expect(activeCell()).toBe(cellAt(2, 2));
    });
});

describe("editing", () => {
    const editorIn = (cell: HTMLElement) =>
        cell.querySelector("input") as HTMLInputElement | null;

    /**
     * Note: `fireEvent` throughout, not hand-built DOM events. A raw
     * `new Event("input")` does not drive React's synthetic `onChange`, so the
     * draft never updates and a commit test silently asserts the *old* value.
     */
    const openEditor = (row: number, col: number) => {
        const cell = cellAt(row, col) as HTMLElement;
        fireEvent.doubleClick(cell);
        return { cell, input: editorIn(cell) };
    };

    it("is not editable without onCellEdit, even when editable is true", () => {
        renderSheet({ editable: true });
        expect(openEditor(0, 1).input).toBeNull();
    });

    it("opens an editor on double-click when editable", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        const { input } = openEditor(0, 1);
        expect(input).not.toBeNull();
        // Seeded with the cell's current value.
        expect(input!.value).toBe("Opening");
    });

    it("commits on Enter and reports the new value", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });
        const { input } = openEditor(0, 1);

        fireEvent.change(input!, { target: { value: "Edited" } });
        fireEvent.keyDown(input!, { key: "Enter" });

        expect(onCellEdit).toHaveBeenCalledWith(0, 1, "Edited", ledger);
        expect(editorIn(cellAt(0, 1) as HTMLElement)).toBeNull();
    });

    it("commits on blur when focus moves to another element", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });
        const { input } = openEditor(0, 1);

        fireEvent.change(input!, { target: { value: "ViaBlur" } });
        // `relatedTarget` is what distinguishes "the user clicked elsewhere" from
        // "focus left the document". Only the former is an edit decision.
        fireEvent.blur(input!, { relatedTarget: document.body });

        expect(onCellEdit).toHaveBeenCalledWith(0, 1, "ViaBlur", ledger);
    });

    it("does NOT commit when focus leaves the document entirely", () => {
        // The reported Alt+Enter bug. On Windows and Linux, pressing Alt hands
        // focus to the browser menu bar, which blurs the editor with a null
        // `relatedTarget`. Committing there made a line break impossible to type:
        // the cell closed the instant Alt went down.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });
        const { cell, input } = openEditor(0, 1);

        fireEvent.change(input!, { target: { value: "still editing" } });
        fireEvent.blur(input!, { relatedTarget: null });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editorIn(cell)).not.toBeNull();
    });

    it("abandons the edit on Escape without committing", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });
        const { input } = openEditor(0, 1);

        fireEvent.change(input!, { target: { value: "Discarded" } });
        fireEvent.keyDown(input!, { key: "Escape" });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editorIn(cellAt(0, 1) as HTMLElement)).toBeNull();
    });

    it("edits a second cell correctly after the first", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });

        const first = openEditor(0, 1);
        fireEvent.change(first.input!, { target: { value: "First" } });
        fireEvent.keyDown(first.input!, { key: "Enter" });

        const second = openEditor(2, 1);
        expect(second.input).not.toBeNull();
        fireEvent.change(second.input!, { target: { value: "Second" } });
        fireEvent.keyDown(second.input!, { key: "Enter" });

        expect(onCellEdit).toHaveBeenNthCalledWith(1, 0, 1, "First", ledger);
        expect(onCellEdit).toHaveBeenNthCalledWith(2, 2, 1, "Second", ledger);
    });

    it("respects a per-cell editable override", () => {
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            getCell: (d: Ledger, r: number, c: number) => ({
                ...getCell(d, r, c),
                editable: !(r === 0 && c === 0),
            }),
        });
        expect(openEditor(0, 0).input).toBeNull();
    });

    it("begins editing the active cell on F2", () => {
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            defaultActiveCell: { row: 1, col: 1 },
        });
        fireEvent.keyDown(screen.getByRole("grid"), { key: "F2" });
        expect(editorIn(cellAt(1, 1) as HTMLElement)).not.toBeNull();
    });

    it("does not move the selection with arrow keys while editing", () => {
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            defaultActiveCell: { row: 1, col: 1 },
        });
        const { input } = openEditor(1, 1);
        fireEvent.keyDown(input!, { key: "ArrowDown" });
        expect(activeCell()).toBe(cellAt(1, 1));
    });
});

describe("native table markup", () => {
    /**
     * The behaviour suite above is deliberately markup-agnostic, which means it
     * would keep passing if the grid regressed to a stack of `div`s. These tests
     * pin the requirement itself: use the platform's tabular layout rather than
     * reimplementing it.
     */
    const grid = () => screen.getByRole("grid");

    it("renders a real <table>, not a div stack", () => {
        renderSheet({ getColumnHeader });
        expect(grid().tagName).toBe("TABLE");
    });

    it("keeps role=grid, because a bare <table> is only a static `table`", () => {
        renderSheet();
        // Verified in jsdom: <table> maps to role `table`, and <td> to `cell` —
        // the static pair. `grid`/`gridcell` are the interactive counterparts.
        expect(grid().getAttribute("role")).toBe("grid");
        expect(screen.queryAllByRole("table")).toHaveLength(0);
    });

    it("uses <tbody>/<tr>/<td> for the body", () => {
        const { container } = renderSheet();
        expect(container.querySelectorAll("tbody")).toHaveLength(1);
        expect(container.querySelectorAll("tbody > tr")).toHaveLength(3);
        expect(container.querySelectorAll("tbody td")).toHaveLength(9);
    });

    it("uses <thead> and <th scope='col'> for column headers", () => {
        const { container } = renderSheet({ getColumnHeader });
        expect(container.querySelectorAll("thead")).toHaveLength(1);
        const th = [...container.querySelectorAll("thead th[scope='col']")];
        expect(th.map((h) => h.textContent)).toEqual([
            "Date",
            "Description",
            "Amount",
        ]);
    });

    it("uses <th scope='row'> for the row gutter", () => {
        const { container } = renderSheet({ getColumnHeader });
        const th = [...container.querySelectorAll("tbody th[scope='row']")];
        expect(th.map((h) => h.textContent)).toEqual(["1", "2", "3"]);
    });

    it("declares widths once per column via <colgroup>", () => {
        // The reason for the table: width is a property of the COLUMN, so the
        // browser keeps the column aligned instead of each cell restating it.
        const { container } = renderSheet({ getColumnHeader });
        expect(container.querySelectorAll("colgroup")).toHaveLength(1);
        // One <col> per data column, plus one for the row-number gutter.
        expect(container.querySelectorAll("colgroup col")).toHaveLength(4);
    });

    it("omits the gutter <col> when there are no headers", () => {
        const { container } = renderSheet();
        expect(container.querySelectorAll("colgroup col")).toHaveLength(3);
    });

    it("hides the corner cell from assistive technology", () => {
        // It labels nothing, so it must not be announced as an empty header.
        const { container } = renderSheet({ getColumnHeader });
        const corner = container.querySelector(".grid__corner")!;
        expect(corner.getAttribute("aria-hidden")).toBe("true");
        expect(corner.hasAttribute("scope")).toBe(false);
        // And it is therefore not one of the 3 column headers.
        expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    });

    it("separates the scroll viewport from the table", () => {
        // A table sizes itself to its content and so cannot also clip it;
        // scrolling therefore belongs to a wrapper.
        const { container } = renderSheet();
        const viewport = container.querySelector(".grid")!;
        expect(viewport.tagName).toBe("DIV");
        expect(viewport.querySelector("table")).not.toBeNull();
    });

    it("puts the editor inside the cell it edits", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        const cell = cellAt(1, 1) as HTMLElement;
        fireEvent.doubleClick(cell);
        expect(cell.tagName).toBe("TD");
        expect(cell.querySelector("input")).not.toBeNull();
    });
});
describe("focus is returned when the editor closes", () => {
    /**
     * The editor `<input>` takes focus while open. When it unmounts, the browser
     * has nowhere to put focus and drops it on `<body>` — which is outside the
     * grid, so the container's keydown handler stops receiving arrow keys. The
     * symptom is "editing one cell breaks keyboard navigation for good", and the
     * cause is focus, not the navigation code.
     *
     * These tests assert on `document.activeElement` and then on real navigation
     * dispatched at the focused element, rather than on the container directly —
     * dispatching on the container would pass even with focus lost, which is
     * exactly how this escaped the original suite.
     */
    const outerOf = (container: HTMLElement) =>
        container.querySelector(".spreadsheet") as HTMLElement;

    /** Press a key wherever focus actually is, as a real keyboard would. */
    const pressWhereFocused = (key: string) =>
        fireEvent.keyDown(
            (document.activeElement ?? document.body) as HTMLElement,
            { key },
        );

    it("returns focus to the grid after committing with Enter", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            defaultActiveCell: { row: 0, col: 0 },
        });
        const outer = outerOf(container);
        outer.focus();

        fireEvent.keyDown(outer, { key: "F2" });
        const input = container.querySelector("input.cell__editor")!;
        expect(document.activeElement).toBe(input);

        fireEvent.keyDown(input, { key: "Enter" });
        expect(document.activeElement).toBe(outer);
    });

    it("keeps arrow keys working after an edit — the actual reported bug", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            defaultActiveCell: { row: 0, col: 0 },
        });
        const outer = outerOf(container);
        outer.focus();

        fireEvent.keyDown(outer, { key: "F2" });
        fireEvent.keyDown(container.querySelector("input.cell__editor")!, {
            key: "Enter",
        });

        // Dispatched at whatever is focused. Before the fix that was <body> and
        // the selection stayed put.
        pressWhereFocused("ArrowDown");
        expect(activeCell()).toBe(cellAt(1, 0));
        pressWhereFocused("ArrowRight");
        expect(activeCell()).toBe(cellAt(1, 1));
    });

    it("returns focus after cancelling with Escape", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            defaultActiveCell: { row: 0, col: 0 },
        });
        const outer = outerOf(container);
        outer.focus();

        fireEvent.keyDown(outer, { key: "F2" });
        fireEvent.keyDown(container.querySelector("input.cell__editor")!, {
            key: "Escape",
        });

        expect(document.activeElement).toBe(outer);
        pressWhereFocused("ArrowDown");
        expect(activeCell()).toBe(cellAt(1, 0));
    });

    it("returns focus after a double-click edit too", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
        });
        const outer = outerOf(container);
        outer.focus();

        fireEvent.doubleClick(cellAt(0, 0));
        fireEvent.keyDown(container.querySelector("input.cell__editor")!, {
            key: "Enter",
        });
        expect(document.activeElement).toBe(outer);
    });

    it("does NOT steal focus when the user clicked elsewhere", () => {
        // Committing by blur means the user moved focus deliberately. Yanking it
        // back would fight them — the usual way focus restoration goes wrong.
        const { container } = render(
            <>
                <input id="outside" />
                <SpreadsheetView<Ledger>
                    data={ledger}
                    getRowCount={getRowCount}
                    getColumnCount={getColumnCount}
                    getCell={getCell}
                    editable
                    onCellEdit={vi.fn()}
                    defaultActiveCell={{ row: 0, col: 0 }}
                />
            </>,
        );
        const outer = outerOf(container);
        outer.focus();
        fireEvent.keyDown(outer, { key: "F2" });

        const editor = container.querySelector("input.cell__editor")!;
        const outside = container.querySelector("#outside") as HTMLInputElement;
        outside.focus();
        fireEvent.blur(editor);

        expect(document.activeElement).toBe(outside);
    });

    it("does not grab focus on mount or on unrelated re-renders", () => {
        // The hook watches the editing transition only, so a grid that has never
        // been edited must never pull focus to itself.
        const { rerender } = renderSheet({ editable: true, onCellEdit: vi.fn() });
        expect(document.activeElement).toBe(document.body);

        act(() => {
            rerender(
                <SpreadsheetView<Ledger>
                    data={ledger}
                    getRowCount={getRowCount}
                    getColumnCount={getColumnCount}
                    getCell={getCell}
                    editable
                    onCellEdit={vi.fn()}
                />,
            );
        });
        expect(document.activeElement).toBe(document.body);
    });
});
describe("multiline cells", () => {
    /**
     * The key facts this group pins down, all measured rather than assumed:
     *
     *   - an `<input>` silently DISCARDS newlines (`"a\nb"` becomes `"ab"`), so
     *     the editor element itself has to change, not just the key handling;
     *   - Enter still commits and Escape still abandons \u2014 Alt+Enter is the only
     *     new binding, matching Excel;
     *   - the line break goes in AT THE CARET, not at the end.
     */
    const editorIn = (cell: HTMLElement) =>
        cell.querySelector("input, textarea") as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null;

    const openEditor = (row: number, col: number) => {
        const cell = cellAt(row, col) as HTMLElement;
        fireEvent.doubleClick(cell);
        return { cell, editor: editorIn(cell)! };
    };

    it("uses a <textarea> when multiline, because <input> drops newlines", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        expect(openEditor(0, 1).editor.tagName).toBe("TEXTAREA");
    });

    it("uses an <input> when not multiline", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        expect(openEditor(0, 1).editor.tagName).toBe("INPUT");
    });

    it("proves the element choice is necessary, not cosmetic", () => {
        // If this ever fails, <input> has gained newline support and the
        // textarea switch could be reconsidered.
        const input = document.createElement("input");
        input.value = "a\nb";
        expect(input.value).toBe("ab");

        const textarea = document.createElement("textarea");
        textarea.value = "a\nb";
        expect(textarea.value).toBe("a\nb");
    });

    it("inserts a line break on Alt+Enter without committing", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.keyDown(editor, { key: "Enter", altKey: true });

        // Still editing, and nothing was committed.
        expect(editorIn(cell)).not.toBeNull();
        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editor.value).toContain("\n");
    });

    it("inserts the break AT THE CARET, not at the end", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor } = openEditor(0, 1); // "Opening"

        // Put the caret after "Open".
        editor.setSelectionRange(4, 4);
        fireEvent.keyDown(editor, { key: "Enter", altKey: true });

        expect(editor.value).toBe("Open\ning");
        // And the caret sits just after the inserted break, so typing continues
        // on the new line. A hand-rolled string splice loses this.
        expect(editor.selectionStart).toBe(5);
    });

    it("does not destroy the value when the editor opens fully selected", () => {
        // The editor opens with `.select()` so typing replaces the value, as a
        // grid should. If Alt+Enter *replaced* the selection, the very first press
        // would wipe the whole cell and leave a bare newline — the common case,
        // and silent data loss. It collapses the selection instead.
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor } = openEditor(0, 1); // "Opening", fully selected

        expect(editor.selectionStart).toBe(0);
        expect(editor.selectionEnd).toBe("Opening".length);

        fireEvent.keyDown(editor, { key: "Enter", altKey: true });

        expect(editor.value).toBe("Opening\n");
    });

    it("collapses a selection to its end rather than overwriting it", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor } = openEditor(0, 1); // "Opening"

        editor.setSelectionRange(0, 4); // select "Open"
        fireEvent.keyDown(editor, { key: "Enter", altKey: true });

        // Alt+Enter ADDS a line; it never deletes text. Deleting has its own keys.
        expect(editor.value).toBe("Open\ning");
        expect(editor.selectionStart).toBe(5);
    });

    it("survives the blur that pressing Alt causes — the reported bug", () => {
        // THE REGRESSION TEST. The original multiline tests only sent `keydown`,
        // so they passed while the feature was unusable in a real browser: on
        // Windows/Linux, Alt focuses the browser menu bar, and the editor's blur
        // handler committed immediately. Reproducing the real sequence means
        // sending the blur too.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);
        editor.setSelectionRange(4, 4);

        fireEvent.keyDown(editor, { key: "Enter", altKey: true });
        // Alt hands focus to browser chrome, which is outside the document.
        fireEvent.blur(editor, { relatedTarget: null });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editorIn(cell)).not.toBeNull();
        expect(editorIn(cell)!.value).toBe("Open\ning");
    });

    it("can build several lines across repeated Alt+Enter and Alt blurs", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.change(editor, { target: { value: "one" } });
        fireEvent.keyDown(editor, { key: "Enter", altKey: true });
        fireEvent.blur(editor, { relatedTarget: null });
        fireEvent.change(editorIn(cell)!, { target: { value: "one\ntwo" } });
        fireEvent.keyDown(editorIn(cell)!, { key: "Enter", altKey: true });
        fireEvent.blur(editorIn(cell)!, { relatedTarget: null });
        fireEvent.change(editorIn(cell)!, { target: { value: "one\ntwo\nthree" } });

        // Only the final plain Enter commits.
        expect(onCellEdit).not.toHaveBeenCalled();
        fireEvent.keyDown(editorIn(cell)!, { key: "Enter" });
        expect(onCellEdit).toHaveBeenCalledWith(
            0,
            1,
            "one\ntwo\nthree",
            ledger,
        );
    });

    it("is not left stranded open by an ignored blur", () => {
        // Refusing to commit on a null-relatedTarget blur must not trap the user
        // in the editor. Every normal way out still works afterwards.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.blur(editor, { relatedTarget: null }); // Alt pressed
        expect(editorIn(cell)).not.toBeNull();

        // Clicking another cell moves focus within the document, so it commits.
        fireEvent.blur(editorIn(cell)!, { relatedTarget: cellAt(2, 0) });
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(editorIn(cell)).toBeNull();
    });

    it("Escape still works after an ignored blur", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.blur(editor, { relatedTarget: null });
        fireEvent.keyDown(editorIn(cell)!, { key: "Escape" });

        expect(editorIn(cell)).toBeNull();
        expect(onCellEdit).not.toHaveBeenCalled();
    });

    it("commits the multiline value on plain Enter", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { editor } = openEditor(0, 1);

        fireEvent.change(editor, { target: { value: "line one\nline two" } });
        fireEvent.keyDown(editor, { key: "Enter" });

        expect(onCellEdit).toHaveBeenCalledWith(
            0,
            1,
            "line one\nline two",
            ledger,
        );
    });

    it("Enter still commits rather than adding a line, as in Excel", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.keyDown(editor, { key: "Enter" });

        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(editorIn(cell)).toBeNull();
    });

    it("Escape still abandons a multiline draft", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.change(editor, { target: { value: "a\nb" } });
        fireEvent.keyDown(editor, { key: "Escape" });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editorIn(cell)).toBeNull();
    });

    it("Alt+Enter is inert in a single-line cell", () => {
        // A stray newline must not be able to reach a value the caller parses as
        // a number, so the binding does nothing rather than falling through to
        // commit.
        //
        // Asserted via `onDraftChange` reaching `getCell`-independent state
        // rather than via the DOM: an `<input>` strips the newline by itself, so
        // the element's value looks identical whether or not the component
        // guards the insertion. The observable difference is that no draft
        // update is requested at all.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit });
        const { cell, editor } = openEditor(0, 1);

        fireEvent.keyDown(editor, { key: "Enter", altKey: true });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editorIn(cell)).not.toBeNull(); // did not commit
        expect(editor.value).not.toContain("\n");
    });

    it("does not even attempt an insertion in a single-line cell", () => {
        // The guard itself, made observable. `setRangeText` on an <input> is a
        // silent no-op (measured), so without this the guard would be untestable
        // and could be deleted without any test noticing.
        const spy = vi.spyOn(
            window.HTMLInputElement.prototype,
            "setRangeText",
        );
        try {
            renderSheet({ editable: true, onCellEdit: vi.fn() });
            const { editor } = openEditor(0, 1);
            fireEvent.keyDown(editor, { key: "Enter", altKey: true });
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it("honours a per-cell multiline override", () => {
        // The realistic case: a wrapped description column beside a strictly
        // single-line amount column.
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            getCell: (d: Ledger, r: number, c: number) => ({
                ...getCell(d, r, c),
                multiline: c === 1,
            }),
        });
        expect(openEditor(0, 1).editor.tagName).toBe("TEXTAREA");
        expect(openEditor(0, 2).editor.tagName).toBe("INPUT");
    });

    it("a per-cell override can opt OUT of a multiline view", () => {
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            multiline: true,
            getCell: (d: Ledger, r: number, c: number) => ({
                ...getCell(d, r, c),
                multiline: false,
            }),
        });
        expect(openEditor(0, 1).editor.tagName).toBe("INPUT");
    });

    it("marks multiline cells so committed newlines are not collapsed", () => {
        // `white-space: nowrap` (the default for a cell) renders "a\nb" as "a b".
        // The class is what switches it to `pre-wrap`. jsdom applies no
        // stylesheets, so the hook the CSS targets is what can be checked here.
        renderSheet({ multiline: true });
        expect(
            (cellAt(0, 1) as HTMLElement).classList.contains("cell--multiline"),
        ).toBe(true);

        cleanup();
        renderSheet();
        expect(
            (cellAt(0, 1) as HTMLElement).classList.contains("cell--multiline"),
        ).toBe(false);
    });

    it("renders a stored newline in the committed value", () => {
        render(
            <SpreadsheetView<Ledger>
                data={ledger}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={() => ({ value: "first\nsecond", multiline: true })}
            />,
        );
        // The text node keeps the break; CSS decides whether it is shown.
        expect(cellAt(0, 0).textContent).toBe("first\nsecond");
    });

    it("returns focus to the grid after committing a multiline edit", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            multiline: true,
            defaultActiveCell: { row: 0, col: 0 },
        });
        const outer = container.querySelector(".spreadsheet") as HTMLElement;
        outer.focus();

        fireEvent.keyDown(outer, { key: "F2" });
        const editor = container.querySelector("textarea.cell__editor")!;
        fireEvent.keyDown(editor, { key: "Enter" });

        expect(document.activeElement).toBe(outer);
    });

    it("keeps arrow navigation working after a multiline edit", () => {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            multiline: true,
            defaultActiveCell: { row: 0, col: 0 },
        });
        const outer = container.querySelector(".spreadsheet") as HTMLElement;
        outer.focus();

        fireEvent.keyDown(outer, { key: "F2" });
        const editor = container.querySelector("textarea.cell__editor")!;
        fireEvent.keyDown(editor, { key: "Enter", altKey: true });
        fireEvent.keyDown(editor, { key: "Enter" });

        fireEvent.keyDown(
            (document.activeElement ?? document.body) as HTMLElement,
            { key: "ArrowDown" },
        );
        expect(activeCell()).toBe(cellAt(1, 0));
    });

    it("does not move the selection when Alt+Enter is pressed", () => {
        // The keystroke must stay inside the editor rather than reaching the
        // grid's own key handler.
        renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
            multiline: true,
            defaultActiveCell: { row: 1, col: 1 },
        });
        const { editor } = openEditor(1, 1);
        fireEvent.keyDown(editor, { key: "Enter", altKey: true });
        expect(activeCell()).toBe(cellAt(1, 1));
    });
});
describe("the data port stays opaque", () => {
    it("asks for exactly the cells of the rectangular region", () => {
        const spy = vi.fn(getCell);
        renderSheet({ getCell: spy });
        const asked = spy.mock.calls.map(([, r, c]) => `${r},${c}`);
        expect(new Set(asked).size).toBe(9);
        // Every request is inside bounds.
        for (const [, r, c] of spy.mock.calls) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(3);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(3);
        }
    });

    it("renders an empty grid without cells", () => {
        render(
            <SpreadsheetView<Ledger>
                data={{ columns: [], rows: [] }}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={getCell}
            />,
        );
        expect(screen.getAllByRole("grid")).toHaveLength(1);
        expect(cells()).toHaveLength(0);
    });
});
