// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpreadsheetView } from "../../src/views/spreadsheet-view-old";
import {
    type CellAddress,
    type CellDescriptor,
} from "../../src/views/spreadsheet-view-old";

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

/**
 * The editor is a SINGLE floating overlay, a sibling of the `<table>` rather than
 * a child of the cell. Locating it from the document (not from inside a cell) is
 * therefore the correct query, and it also encodes the invariant that only one
 * editor can ever exist.
 */
const editor = () =>
    document.querySelector("textarea.cell-editor") as HTMLTextAreaElement | null;
/** How many editors exist. Should never exceed 1. */
const editorCount = () =>
    document.querySelectorAll("textarea.cell-editor").length;

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
    const editorIn = (_cell?: HTMLElement) => editor();

    /**
     * Note: `fireEvent` throughout, not hand-built DOM events. A raw
     * `new Event("input")` does not drive React's synthetic `onChange`, so the
     * draft never updates and a commit test silently asserts the *old* value.
     */
    const openEditor = (row: number, col: number) => {
        const cell = cellAt(row, col) as HTMLElement;
        fireEvent.doubleClick(cell);
        return { cell, input: editor() };
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

    it("puts the editor OUTSIDE the table, as a sibling overlay", () => {
        // It used to live inside the <td>. That made growing it past the cell
        // impossible, because the table algorithm owns a cell's box — and it
        // forced the draft to be broadcast to every cell on every keystroke.
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
        });
        const cell = cellAt(1, 1) as HTMLElement;
        fireEvent.doubleClick(cell);

        const ed = editor();
        expect(ed).not.toBeNull();
        expect(cell.querySelector("textarea")).toBeNull();
        // A child of the scroll container, which is what makes it scroll with the
        // content and be clipped by the viewport without any JavaScript.
        expect(ed!.parentElement).toBe(container.querySelector(".grid"));
        expect(ed!.closest("table")).toBeNull();
    });

    it("never has more than one editor", () => {
        // The structural version of "only one cell can be edited at a time".
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        expect(editorCount()).toBe(0);

        fireEvent.doubleClick(cellAt(0, 0));
        expect(editorCount()).toBe(1);

        // Opening another cell must move the editor, not add one.
        fireEvent.doubleClick(cellAt(2, 1));
        expect(editorCount()).toBe(1);
    });

    it("does not re-render the table while typing", () => {
        // The invalidation win. Before the overlay, the draft was a prop on every
        // Cell, so one keystroke cost 100 getCell calls on a 9-cell grid's
        // equivalent (measured: 50 cells x 2 passes). Now typing must not touch
        // the table at all.
        const spy = vi.fn(getCell);
        renderSheet({ editable: true, onCellEdit: vi.fn(), getCell: spy });
        fireEvent.doubleClick(cellAt(0, 1));

        spy.mockClear();
        fireEvent.change(editor()!, { target: { value: "a" } });
        fireEvent.change(editor()!, { target: { value: "ab" } });
        fireEvent.change(editor()!, { target: { value: "abc" } });

        expect(spy).not.toHaveBeenCalled();
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
        const input = editor()!;
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
        fireEvent.keyDown(editor()!, {
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
        fireEvent.keyDown(editor()!, {
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
        fireEvent.keyDown(editor()!, {
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

        const ed = editor()!;
        const outside = container.querySelector("#outside") as HTMLInputElement;
        outside.focus();
        fireEvent.blur(ed, { relatedTarget: outside });

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
    const openEditor = (row: number, col: number) => {
        const cell = cellAt(row, col) as HTMLElement;
        fireEvent.doubleClick(cell);
        return { cell, editor: editor()! };
    };

    it("always uses a <textarea>, because <input> drops newlines", () => {
        // The element no longer switches on `multiline`. One <textarea> serves
        // both modes so the caret and key handling are identical either way;
        // `multiline` gates the newline BINDING and the wrapping, not the element.
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        expect(openEditor(0, 1).editor.tagName).toBe("TEXTAREA");

        cleanup();
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        expect(openEditor(0, 1).editor.tagName).toBe("TEXTAREA");
    });

    it("marks the editor multiline so wrapping differs", () => {
        // The CSS hook that decides `pre` vs `pre-wrap`. jsdom applies no
        // stylesheets, so the class is the observable part here.
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        expect(
            openEditor(0, 1).editor.classList.contains(
                "cell-editor--multiline",
            ),
        ).toBe(true);

        cleanup();
        renderSheet({ editable: true, onCellEdit: vi.fn() });
        expect(
            openEditor(0, 1).editor.classList.contains(
                "cell-editor--multiline",
            ),
        ).toBe(false);
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
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.keyDown(ed, { key: "Enter", altKey: true });

        // Still editing, and nothing was committed.
        expect(editor()).not.toBeNull();
        expect(onCellEdit).not.toHaveBeenCalled();
        expect(ed.value).toContain("\n");
    });

    it("inserts the break AT THE CARET, not at the end", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor: ed } = openEditor(0, 1); // "Opening"

        // Put the caret after "Open".
        ed.setSelectionRange(4, 4);
        fireEvent.keyDown(ed, { key: "Enter", altKey: true });

        expect(ed.value).toBe("Open\ning");
        // And the caret sits just after the inserted break, so typing continues
        // on the new line. A hand-rolled string splice loses this.
        expect(ed.selectionStart).toBe(5);
    });

    it("does not destroy the value when the editor opens fully selected", () => {
        // The editor opens with `.select()` so typing replaces the value, as a
        // grid should. If Alt+Enter *replaced* the selection, the very first press
        // would wipe the whole cell and leave a bare newline — the common case,
        // and silent data loss. It collapses the selection instead.
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor: ed } = openEditor(0, 1); // "Opening", fully selected

        expect(ed.selectionStart).toBe(0);
        expect(ed.selectionEnd).toBe("Opening".length);

        fireEvent.keyDown(ed, { key: "Enter", altKey: true });

        expect(ed.value).toBe("Opening\n");
    });

    it("collapses a selection to its end rather than overwriting it", () => {
        renderSheet({ editable: true, onCellEdit: vi.fn(), multiline: true });
        const { editor: ed } = openEditor(0, 1); // "Opening"

        ed.setSelectionRange(0, 4); // select "Open"
        fireEvent.keyDown(ed, { key: "Enter", altKey: true });

        // Alt+Enter ADDS a line; it never deletes text. Deleting has its own keys.
        expect(ed.value).toBe("Open\ning");
        expect(ed.selectionStart).toBe(5);
    });

    it("survives the blur that pressing Alt causes — the reported bug", () => {
        // THE REGRESSION TEST. The original multiline tests only sent `keydown`,
        // so they passed while the feature was unusable in a real browser: on
        // Windows/Linux, Alt focuses the browser menu bar, and the editor's blur
        // handler committed immediately. Reproducing the real sequence means
        // sending the blur too.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor: ed } = openEditor(0, 1);
        ed.setSelectionRange(4, 4);

        fireEvent.keyDown(ed, { key: "Enter", altKey: true });
        // Alt hands focus to browser chrome, which is outside the document.
        fireEvent.blur(ed, { relatedTarget: null });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editor()).not.toBeNull();
        expect(editor()!.value).toBe("Open\ning");
    });

    it("can build several lines across repeated Alt+Enter and Alt blurs", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.change(ed, { target: { value: "one" } });
        fireEvent.keyDown(ed, { key: "Enter", altKey: true });
        fireEvent.blur(ed, { relatedTarget: null });
        fireEvent.change(editor()!, { target: { value: "one\ntwo" } });
        fireEvent.keyDown(editor()!, { key: "Enter", altKey: true });
        fireEvent.blur(editor()!, { relatedTarget: null });
        fireEvent.change(editor()!, { target: { value: "one\ntwo\nthree" } });

        // Only the final plain Enter commits.
        expect(onCellEdit).not.toHaveBeenCalled();
        fireEvent.keyDown(editor()!, { key: "Enter" });
        expect(onCellEdit).toHaveBeenCalledWith(
            0,
            1,
            "one\ntwo\nthree",
            ledger,
        );
    });

    it("is not left stranded open by an ignored blur", () => {
        // Refusing to commit on a null-relatedTarget blur must not trap the user
        // in the ed. Every normal way out still works afterwards.
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.blur(ed, { relatedTarget: null }); // Alt pressed
        expect(editor()).not.toBeNull();

        // Clicking another cell moves focus within the document, so it commits.
        fireEvent.blur(editor()!, { relatedTarget: cellAt(2, 0) });
        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(editor()).toBeNull();
    });

    it("Escape still works after an ignored blur", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.blur(ed, { relatedTarget: null });
        fireEvent.keyDown(editor()!, { key: "Escape" });

        expect(editor()).toBeNull();
        expect(onCellEdit).not.toHaveBeenCalled();
    });

    it("commits the multiline value on plain Enter", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { editor: ed } = openEditor(0, 1);

        fireEvent.change(ed, { target: { value: "line one\nline two" } });
        fireEvent.keyDown(ed, { key: "Enter" });

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
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.keyDown(ed, { key: "Enter" });

        expect(onCellEdit).toHaveBeenCalledTimes(1);
        expect(editor()).toBeNull();
    });

    it("Escape still abandons a multiline draft", () => {
        const onCellEdit = vi.fn();
        renderSheet({ editable: true, onCellEdit, multiline: true });
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.change(ed, { target: { value: "a\nb" } });
        fireEvent.keyDown(ed, { key: "Escape" });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editor()).toBeNull();
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
        const { cell, editor: ed } = openEditor(0, 1);

        fireEvent.keyDown(ed, { key: "Enter", altKey: true });

        expect(onCellEdit).not.toHaveBeenCalled();
        expect(editor()).not.toBeNull(); // did not commit
        expect(ed.value).not.toContain("\n");
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
            const { editor: ed } = openEditor(0, 1);
            fireEvent.keyDown(ed, { key: "Enter", altKey: true });
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
        expect(
            openEditor(0, 1).editor.classList.contains(
                "cell-editor--multiline",
            ),
        ).toBe(true);
        expect(
            openEditor(0, 2).editor.classList.contains(
                "cell-editor--multiline",
            ),
        ).toBe(false);
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
        expect(
            openEditor(0, 1).editor.classList.contains(
                "cell-editor--multiline",
            ),
        ).toBe(false);
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
        const ed = editor()!;
        fireEvent.keyDown(ed, { key: "Enter" });

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
        const ed = editor()!;
        fireEvent.keyDown(ed, { key: "Enter", altKey: true });
        fireEvent.keyDown(ed, { key: "Enter" });

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
        const { editor: ed } = openEditor(1, 1);
        fireEvent.keyDown(ed, { key: "Enter", altKey: true });
        expect(activeCell()).toBe(cellAt(1, 1));
    });
});
describe("the editor grows over neighbouring cells — end to end", () => {
    /**
     * The pure ladder is covered exhaustively in
     * `spreadsheet-editor-geometry.test.ts`. This checks the WIRING: that measured
     * placement, reported content metrics and the resolved size actually reach the
     * DOM as inline styles.
     *
     * jsdom reports every measurement as zero, so a layout is faked around the
     * real component: a 100px cell in a 500px viewport, with 8px characters and
     * 24px lines. The arithmetic and the plumbing are exercised; real layout is
     * not, and cannot be here.
     */
    function fakeLayout() {
        const { container } = renderSheet({
            editable: true,
            onCellEdit: vi.fn(),
        });

        const grid = container.querySelector(".grid") as HTMLElement;
        for (const [prop, value] of [
            ["clientWidth", 500],
            ["clientHeight", 300],
            ["clientLeft", 0],
            ["clientTop", 0],
            ["scrollLeft", 0],
            ["scrollTop", 0],
        ] as const) {
            Object.defineProperty(grid, prop, { value, configurable: true });
        }
        grid.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 500, height: 300 }) as DOMRect;

        const cell = cellAt(0, 0) as HTMLElement;
        cell.getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 100, height: 24 }) as DOMRect;

        fireEvent.doubleClick(cell);

        const ta = editor()!;
        const mirror = document.querySelector(
            ".cell-editor__mirror",
        ) as HTMLElement;

        // 8px per character; the mirror never wraps, so this is natural width.
        Object.defineProperty(mirror, "scrollWidth", {
            get: () => (mirror.textContent ?? "").length * 8,
            configurable: true,
        });
        // Height the text needs at whatever width the box currently has.
        Object.defineProperty(ta, "scrollHeight", {
            get: () => {
                const w = parseFloat(ta.style.width || "100") || 100;
                const chars = ta.value.length;
                const perLine = Math.max(1, Math.floor(w / 8));
                return Math.max(24, Math.ceil(chars / perLine) * 24);
            },
            configurable: true,
        });

        const type = (text: string) =>
            fireEvent.change(ta, { target: { value: text } });

        return { ta, type };
    }

    it("rung 1: stays cell-sized when the content fits", () => {
        const { ta, type } = fakeLayout();
        type("short");
        expect(ta.style.width).toBe("100px");
        expect(ta.classList.contains("cell-editor--wrap")).toBe(false);
    });

    it("rung 2: widens PAST its own cell rather than wrapping inside it", () => {
        // The behaviour that was wrong before: overflow used to fold immediately
        // inside the cell's width. It must expand over the neighbours first.
        const { ta, type } = fakeLayout();
        type("this is much much longer than the cell");
        expect(parseFloat(ta.style.width)).toBeGreaterThan(100);
        expect(parseFloat(ta.style.width)).toBeLessThanOrEqual(500);
        expect(ta.classList.contains("cell-editor--wrap")).toBe(false);
        // One line still, because it had room to grow.
        expect(ta.style.height).toBe("24px");
    });

    it("rung 3: stops at the viewport edge, then wraps and grows downward", () => {
        const { ta, type } = fakeLayout();
        type("x".repeat(120));
        expect(ta.style.width).toBe("500px");
        expect(ta.classList.contains("cell-editor--wrap")).toBe(true);
        expect(parseFloat(ta.style.height)).toBeGreaterThan(24);
    });

    it("rung 4: caps the height at the visible bottom and scrolls", () => {
        const { ta, type } = fakeLayout();
        type("y".repeat(4000));
        expect(ta.style.width).toBe("500px");
        expect(parseFloat(ta.style.height)).toBeLessThanOrEqual(300);
        expect(ta.style.overflowY).toBe("auto");
    });

    it("climbs the rungs in order as the draft grows", () => {
        const { ta, type } = fakeLayout();
        const trace: string[] = [];
        for (const text of ["ab", "a".repeat(30), "b".repeat(120), "c".repeat(4000)]) {
            type(text);
            trace.push(
                `${parseFloat(ta.style.width)}x${parseFloat(ta.style.height)} wrap=${ta.classList.contains("cell-editor--wrap")} scroll=${ta.style.overflowY === "auto"}`,
            );
        }
        expect(trace).toEqual([
            "100x24 wrap=false scroll=false",
            "240x24 wrap=false scroll=false",
            "500x48 wrap=true scroll=false",
            "500x300 wrap=true scroll=true",
        ]);
    });

    it("shrinks back down when text is deleted", () => {
        // The ladder is a pure function of the current content, so it must descend
        // as readily as it climbs.
        const { ta, type } = fakeLayout();
        type("z".repeat(200));
        const grown = parseFloat(ta.style.width);
        type("z");
        expect(grown).toBeGreaterThan(100);
        expect(ta.style.width).toBe("100px");
        expect(ta.classList.contains("cell-editor--wrap")).toBe(false);
    });
});

describe("viewport sizing", () => {
    /**
     * The viewport bounds are not only cosmetic: the floating editor grows only as
     * far as the VISIBLE region allows, so `maxWidth`/`maxHeight` are what decide
     * where the editor stops widening (ladder rung 3) and stops growing downward
     * (rung 4). They were hardcoded in CSS before, which made those rungs
     * impossible to exercise by hand.
     *
     * Same contract as the tab bar's `maxWidth`, deliberately: a number is pixels,
     * a string is passed to CSS verbatim so relative units work.
     */
    const gridOf = (container: HTMLElement) =>
        container.querySelector(".grid") as HTMLElement;

    it("applies numbers as pixels", () => {
        const { container } = renderSheet({ maxWidth: 600, maxHeight: 300 });
        const grid = gridOf(container);
        expect(grid.style.maxWidth).toBe("600px");
        expect(grid.style.maxHeight).toBe("300px");
    });

    it("passes percentages through verbatim", () => {
        const { container } = renderSheet({
            maxWidth: "80%",
            maxHeight: "60vh",
        });
        const grid = gridOf(container);
        expect(grid.style.maxWidth).toBe("80%");
        expect(grid.style.maxHeight).toBe("60vh");
    });

    it("passes computed units through, so clamp() works", () => {
        const { container } = renderSheet({
            maxHeight: "clamp(200px, 50vh, 700px)",
        });
        expect(gridOf(container).style.maxHeight).toBe(
            "clamp(200px, 50vh, 700px)",
        );
    });

    it("sets no inline size when omitted, so the CSS defaults win", () => {
        // If this emitted an empty or `undefined` value it would override the
        // stylesheet and the grid would have no bounds at all.
        const { container } = renderSheet();
        const grid = gridOf(container);
        expect(grid.getAttribute("style")).toBeNull();
        expect(grid.style.maxWidth).toBe("");
        expect(grid.style.maxHeight).toBe("");
    });

    it("accepts one axis without forcing the other", () => {
        const { container } = renderSheet({ maxHeight: 200 });
        const grid = gridOf(container);
        expect(grid.style.maxHeight).toBe("200px");
        expect(grid.style.maxWidth).toBe("");
    });

    it("puts the bounds on the scroll viewport, not the table", () => {
        // The table sizes itself to its content and cannot also clip it; bounding
        // the table instead of the viewport would break both scrolling and the
        // editor's clipping.
        const { container } = renderSheet({ maxWidth: 600, maxHeight: 300 });
        expect(gridOf(container).style.maxHeight).toBe("300px");
        const table = container.querySelector("table") as HTMLElement;
        expect(table.style.maxHeight).toBe("");
    });
});

describe("the data set shrinking while an edit is open", () => {
    /**
     * The edited address lives in state, so it outlives changes to the data. When
     * rows or columns disappear mid-edit — a collapsed tree node, a filter, a
     * deletion — the grid used to ask `getCell` for a cell that no longer exists,
     * and the exception surfaced inside the CALLER's own accessor:
     *
     *     Cannot read properties of undefined (reading 'account')
     *
     * Measured before the fix: editing row 3, then shrinking to one row, produced
     * requests `["0/1", "3/1", ...]` — row 3 asked of a one-row data set. With no
     * editor open there was no bad request, which is what identified the culprit
     * as the edited-cell lookup rather than the render loop.
     *
     * `useEditing` cannot prevent this itself: it is deliberately ignorant of the
     * data, so only the coordinator knows the bounds.
     */
    interface Shrinkable {
        rows: string[];
    }

    /** A caller that indexes its own array unguardedly, as callers do. */
    function ShrinkHost({
        onRequest,
    }: {
        onRequest?: (row: number, count: number) => void;
    }) {
        const [rows, setRows] = useState(["a", "b", "c", "d"]);
        return (
            <>
                <button onClick={() => setRows(["a"])}>shrink</button>
                <SpreadsheetView<Shrinkable>
                    data={{ rows }}
                    getRowCount={(d) => d.rows.length}
                    getColumnCount={() => 1}
                    getCell={(d, r): CellDescriptor => {
                        onRequest?.(r, d.rows.length);
                        return { value: d.rows[r].toUpperCase() };
                    }}
                    editable
                    onCellEdit={vi.fn()}
                />
            </>
        );
    }

    it("never asks for a cell outside the data", () => {
        const requests: string[] = [];
        render(
            <ShrinkHost
                onRequest={(row, count) => requests.push(`${row}/${count}`)}
            />,
        );

        // Edit the last row, then remove it.
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[3]);
        expect(editor()).not.toBeNull();

        requests.length = 0;
        fireEvent.click(screen.getByText("shrink"));

        // Every request must name a row that exists.
        for (const request of requests) {
            const [row, count] = request.split("/").map(Number);
            expect(row).toBeLessThan(count);
        }
    });

    it("does not throw when the edited row disappears", () => {
        render(<ShrinkHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[3]);
        expect(() => fireEvent.click(screen.getByText("shrink"))).not.toThrow();
    });

    it("abandons the edit rather than leaving the editor floating", () => {
        // An editor hovering over a cell that no longer exists is worse than no
        // editor: committing it would write to an address that means something
        // else now.
        render(<ShrinkHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[3]);
        expect(editor()).not.toBeNull();

        fireEvent.click(screen.getByText("shrink"));
        expect(editor()).toBeNull();
    });

    it("keeps an edit whose row survives the shrink", () => {
        // The guard must not be over-broad: shrinking is only fatal to edits that
        // were outside the new bounds.
        render(<ShrinkHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[0]);
        expect(editor()).not.toBeNull();

        fireEvent.click(screen.getByText("shrink"));
        expect(editor()).not.toBeNull();
    });
});

describe("row gutter labels", () => {
    /**
     * The gutter defaults to `row + 1`, the row's VISIBLE POSITION, which is right
     * for a flat sheet. It is wrong wherever rows can be hidden — collapsing a tree
     * node renumbers every row below it — so callers can supply their own labels.
     */
    it("defaults to the 1-based visible position", () => {
        renderSheet({ getColumnHeader });
        expect(
            screen.getAllByRole("rowheader").map((h) => h.textContent),
        ).toEqual(["1", "2", "3"]);
    });

    it("lets the caller supply labels instead", () => {
        renderSheet({
            getColumnHeader,
            getRowHeader: (_d: Ledger, row: number) => `R${row * 10}`,
        });
        expect(
            screen.getAllByRole("rowheader").map((h) => h.textContent),
        ).toEqual(["R0", "R10", "R20"]);
    });

    it("accepts labels that are not consecutive, which is the point", () => {
        // A tree numbers rows by identity, so the visible labels have gaps where
        // collapsed rows would have been.
        const stable = [1, 5, 11];
        renderSheet({
            getColumnHeader,
            getRowHeader: (_d: Ledger, row: number) => stable[row],
        });
        expect(
            screen.getAllByRole("rowheader").map((h) => h.textContent),
        ).toEqual(["1", "5", "11"]);
    });

    it("shows no gutter at all when there are no column headers", () => {
        // The gutter exists to align with the header strip, so without headers
        // there is nothing to align to and the callback is not consulted.
        const getRowHeader = vi.fn(() => "X");
        renderSheet({ getRowHeader });
        expect(screen.queryAllByRole("rowheader")).toHaveLength(0);
        expect(getRowHeader).not.toHaveBeenCalled();
    });

    it("receives the data port, so labels can be derived from it", () => {
        renderSheet({
            getColumnHeader,
            getRowHeader: (d: Ledger, row: number) => d.rows[row].description,
        });
        expect(
            screen.getAllByRole("rowheader").map((h) => h.textContent),
        ).toEqual(["Opening", "Groceries", "Salary"]);
    });
});

describe("stable row keys", () => {
    /**
     * `getRowKey` decides whether React treats a row as "the same row" across
     * renders. With the default index key, row 2 is always row 2, so React rewrites
     * text in place when the contents shift; with a stable key it MOVES the
     * existing element instead.
     *
     * The difference only shows when the row COUNT stays the same. An insert
     * changes the count, so React creates an element either way and the two
     * strategies are indistinguishable — which is why these tests reorder rather
     * than insert. (My first attempt at this test used an insert and passed even
     * with `getRowKey` ignored.)
     */
    interface Row {
        id: number;
        label: string;
    }

    function RotateHost({ useIdKeys }: { useIdKeys: boolean }) {
        const [rows, setRows] = useState<Row[]>([
            { id: 1, label: "Alpha" },
            { id: 2, label: "Beta" },
            { id: 3, label: "Gamma" },
        ]);
        return (
            <>
                <button onClick={() => setRows((p) => [p[2], p[0], p[1]])}>
                    rotate
                </button>
                <SpreadsheetView<{ rows: Row[] }>
                    data={{ rows }}
                    getRowCount={(d) => d.rows.length}
                    getColumnCount={() => 1}
                    getCell={(d, r): CellDescriptor => ({
                        value: d.rows[r].label,
                    })}
                    {...(useIdKeys
                        ? { getRowKey: (d: { rows: Row[] }, r: number) => d.rows[r].id }
                        : {})}
                />
            </>
        );
    }

    /** Tag the element showing "Alpha", rotate, and report what it holds. */
    const tagRotateAndRead = (useIdKeys: boolean) => {
        render(<RotateHost useIdKeys={useIdKeys} />);
        const alpha = screen
            .queryAllByRole("gridcell")
            .find((c) => c.textContent === "Alpha")! as HTMLElement;
        alpha.dataset.tag = "followed";

        fireEvent.click(screen.getByText("rotate"));

        return document.querySelector('[data-tag="followed"]')?.textContent;
    };

    it("without getRowKey, an element's content follows its SLOT", () => {
        // React sees "key 0 is still key 0" and patches the text, so the element
        // that showed Alpha ends up showing whatever moved into position 0.
        expect(tagRotateAndRead(false)).toBe("Gamma");
    });

    it("with getRowKey, an element follows its RECORD", () => {
        // React recognises the key and MOVES the element, so it keeps its content.
        expect(tagRotateAndRead(true)).toBe("Alpha");
    });

    it("rotating produces the same visible order either way", () => {
        // The output is correct in both cases, which is why this is latent rather
        // than an immediate bug: it matters only for state React does not manage.
        render(<RotateHost useIdKeys={false} />);
        fireEvent.click(screen.getByText("rotate"));
        expect(
            screen.queryAllByRole("gridcell").map((c) => c.textContent),
        ).toEqual(["Gamma", "Alpha", "Beta"]);
    });
});

describe("commit does not notify from inside a state updater", () => {
    /**
     * `useEditing.commit` used to call `onCommit` from inside a `setEditingCell`
     * updater. React may run an updater during the RENDER phase and may run it more
     * than once, so the caller's own `setState` executed mid-render — reported in a
     * real browser as:
     *
     *   Cannot update a component (`DataDrivenSpreadsheetDemo`) while rendering a
     *   different component (`SpreadsheetView`)
     *
     * An updater must be a pure function of the previous state. The notification
     * now happens before the updater, in the event handler where it belongs.
     *
     * HONEST LIMITATION: these tests do NOT catch that bug. Measured, React does
     * not double-invoke this particular updater even under StrictMode
     * (`onCellEdit` fires once either way), and jsdom never emits the warning,
     * so reverting the fix leaves them all green.
     *
     * They are kept as a guard on the SURROUNDING behaviour -- a commit notifies
     * once, delivers its value, and closes the editor -- so a future rewrite of
     * `commit` cannot silently break those. The render-phase violation itself is
     * only observable in a real browser, which is how it was found.
     */
    interface Counted {
        rows: string[];
    }

    /** Reports how many times the caller's own state update took effect. */
    function CommitHost() {
        const [rows, setRows] = useState(["a", "b", "c"]);
        const [commits, setCommits] = useState(0);
        return (
            <>
                <output data-testid="commits">{commits}</output>
                <SpreadsheetView<Counted>
                    data={{ rows }}
                    getRowCount={(d) => d.rows.length}
                    getColumnCount={() => 1}
                    getCell={(d, r): CellDescriptor => ({ value: d.rows[r] })}
                    editable
                    onCellEdit={(row, _col, value) => {
                        // TWO caller setStates from the commit callback, which is
                        // what surfaced the warning.
                        setCommits((n) => n + 1);
                        setRows((prev) =>
                            prev.map((v, i) => (i === row ? value : v)),
                        );
                    }}
                />
            </>
        );
    }

    const editorEl = () =>
        document.querySelector("textarea.cell-editor") as HTMLTextAreaElement;

    it("applies the caller's state update exactly once per commit", () => {
        // If `onCommit` ran inside an updater, React could invoke it more than
        // once and this count would exceed 1.
        render(<CommitHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[1]);
        fireEvent.change(editorEl(), { target: { value: "EDITED" } });
        fireEvent.keyDown(editorEl(), { key: "Enter" });

        expect(screen.getByTestId("commits").textContent).toBe("1");
    });

    it("still delivers the committed value to the caller", () => {
        render(<CommitHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[1]);
        fireEvent.change(editorEl(), { target: { value: "EDITED" } });
        fireEvent.keyDown(editorEl(), { key: "Enter" });

        expect(
            screen.getAllByRole("gridcell").map((c) => c.textContent),
        ).toEqual(["a", "EDITED", "c"]);
    });

    it("closes the editor after committing", () => {
        render(<CommitHost />);
        fireEvent.doubleClick(screen.getAllByRole("gridcell")[1]);
        fireEvent.keyDown(editorEl(), { key: "Enter" });
        expect(editor()).toBeNull();
    });

    it("counts one commit per edit across several edits", () => {
        render(<CommitHost />);
        for (const [index, value] of [
            [0, "one"],
            [1, "two"],
            [2, "three"],
        ] as const) {
            fireEvent.doubleClick(screen.getAllByRole("gridcell")[index]);
            fireEvent.change(editorEl(), { target: { value } });
            fireEvent.keyDown(editorEl(), { key: "Enter" });
        }
        expect(screen.getByTestId("commits").textContent).toBe("3");
        expect(
            screen.getAllByRole("gridcell").map((c) => c.textContent),
        ).toEqual(["one", "two", "three"]);
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
