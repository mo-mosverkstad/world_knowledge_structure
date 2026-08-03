// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import {
    SpreadsheetView,
    useSelectionController,
    type CellDescriptor,
    type SelectionController,
} from "../../src/views/spreadsheet-view";

afterEach(cleanup);

interface Sheet {
    rows: number;
    cols: number;
}

function setup(sheet: Sheet = { rows: 10, cols: 5 }) {
    const counter = { calls: 0 };
    let controller!: SelectionController;

    function Host() {
        controller = useSelectionController();
        return (
            <SpreadsheetView<Sheet>
                data={sheet}
                getRowCount={(d) => d.rows}
                getColumnCount={(d) => d.cols}
                getCell={(_d, row, col): CellDescriptor => {
                    counter.calls++;
                    return { value: `${row}.${col}` };
                }}
                selectionController={controller}
                viewportWidth={400}
                viewportHeight={300}
            />
        );
    }

    render(<Host />);
    return {
        counter,
        get controller() {
            return controller;
        },
        cell: (row: number, col: number) =>
            document.querySelector<HTMLElement>(
                `[data-row="${row}"][data-col="${col}"]`,
            )!,
        boxes: () => document.querySelectorAll(".selection-range"),
    };
}

describe("selecting by pointer", () => {
    it("pressing a cell selects it", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(2, 3), { button: 0 });
        expect(s.controller.getActiveCell()).toEqual({ row: 2, col: 3 });
    });

    it("selection begins on mousedown, not click", () => {
        // A drag has to start before it ends.
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        expect(s.controller.getRanges()).toHaveLength(1);
    });

    it("a right-click does not select", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 2 });
        expect(s.controller.getRanges()).toEqual([]);
    });

    it("dragging extends the range", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseEnter(s.cell(3, 3));
        fireEvent.mouseUp(window);
        expect(s.controller.countCells()).toBe(9);
    });

    it("hovering without a button held changes nothing", () => {
        const s = setup();
        fireEvent.mouseEnter(s.cell(2, 2));
        expect(s.controller.getRanges()).toEqual([]);
    });

    it("hovering after the drag ends changes nothing", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        fireEvent.mouseEnter(s.cell(4, 4));
        expect(s.controller.countCells()).toBe(1);
    });

    it("a mouseup outside the grid still ends the drag", () => {
        // Drags routinely end past the last row, where no cell handler would fire.
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        expect(s.controller.getSnapshot().dragging).toBe(false);
    });

    it("losing window focus mid-drag ends it", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.blur(window);
        expect(s.controller.getSnapshot().dragging).toBe(false);
    });

    it("ctrl+click adds a range; a plain click replaces", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        fireEvent.mouseDown(s.cell(4, 4), { button: 0, ctrlKey: true });
        fireEvent.mouseUp(window);
        expect(s.controller.getRanges()).toHaveLength(2);
        fireEvent.mouseDown(s.cell(2, 2), { button: 0 });
        expect(s.controller.getRanges()).toHaveLength(1);
    });
});

describe("the overlay", () => {
    it("draws nothing until something is selected", () => {
        expect(setup().boxes()).toHaveLength(0);
    });

    it("draws one box per range", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        fireEvent.mouseDown(s.cell(4, 4), { button: 0, ctrlKey: true });
        fireEvent.mouseUp(window);
        expect(s.boxes()).toHaveLength(2);
    });

    it("hides the boxes from assistive technology", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        expect(s.boxes()[0].getAttribute("aria-hidden")).toBe("true");
    });

    it("looks the same during a drag as after one", () => {
        // A drag and a click produce the same selection, so they must not be drawn
        // differently. An earlier version gave the in-progress box a dashed border.
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseEnter(s.cell(2, 2));
        const during = s.boxes()[0].className;
        fireEvent.mouseUp(window);
        expect(s.boxes()[0].className).toBe(during);
        expect(during).toBe("selection-range");
    });

    it("leaves the cell's own text in place", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(1, 1), { button: 0 });
        fireEvent.mouseUp(window);
        expect(s.cell(1, 1).textContent).toBe("1.1");
    });

    it("gives the active-cell marker no background", () => {
        // A white background painted OVER the cell's value, which read as blanked
        // text. jsdom applies no stylesheets, so the rule itself is asserted.
        const css = readFileSync(
            "src/views/spreadsheet-view/SelectionRange.css",
            "utf8",
        );
        const block = css.slice(css.indexOf(".selection-range__active-cell"));
        expect(block.slice(0, block.indexOf("}"))).not.toMatch(/background/);
    });

    it("disappears when the selection is cleared", () => {
        const s = setup();
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        // fireEvent acts for us; a direct controller call does not.
        act(() => s.controller.clear());
        expect(s.boxes()).toHaveLength(0);
    });
});

describe("selection does not re-render the table", () => {
    /*
     * The table cannot render without calling `getCell` per cell, so counting
     * those calls measures whether it re-rendered. Routing selection through
     * `getCell` instead measured 100 calls for a click and 650 for a 12-cell drag.
     */
    it("calls getCell once per cell on mount", () => {
        // Guards against the counter measuring nothing.
        expect(setup({ rows: 10, cols: 5 }).counter.calls).toBe(50);
    });

    it("costs nothing for a click", () => {
        const s = setup();
        s.counter.calls = 0;
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        fireEvent.mouseUp(window);
        expect(s.counter.calls).toBe(0);
    });

    it("costs nothing for a multi-cell drag", () => {
        const s = setup();
        s.counter.calls = 0;
        fireEvent.mouseDown(s.cell(0, 0), { button: 0 });
        for (let row = 1; row < 8; row++) fireEvent.mouseEnter(s.cell(row, 3));
        fireEvent.mouseUp(window);
        expect(s.counter.calls).toBe(0);
    });

    it("costs nothing when the host selects or clears", () => {
        const s = setup();
        s.counter.calls = 0;
        act(() => s.controller.selectRange({ row: 0, col: 0 }, { row: 9, col: 4 }));
        act(() => s.controller.clear());
        expect(s.counter.calls).toBe(0);
    });
});

describe("the host drives the selection", () => {
    it("can select from outside the grid and read it back", () => {
        const s = setup();
        act(() => s.controller.selectRange({ row: 0, col: 0 }, { row: 9, col: 4 }));
        expect(s.controller.countCells()).toBe(50);
        expect(s.boxes()).toHaveLength(1);
        expect(s.controller.isSelected(5, 2)).toBe(true);
    });
});

describe("the viewport", () => {
    /** Render with only the dimensions that matter and read the inline style. */
    const styleFor = (w: string | number, h: string | number) => {
        render(
            <SpreadsheetView<Sheet>
                data={{ rows: 30, cols: 3 }}
                getRowCount={(d) => d.rows}
                getColumnCount={(d) => d.cols}
                getCell={(_d, row, col): CellDescriptor => ({ value: `${row}.${col}` })}
                viewportWidth={w}
                viewportHeight={h}
            />,
        );
        return document.querySelector<HTMLElement>(".spreadsheet-viewport")!.style;
    };

    it("bounds the viewport rather than fixing its size", () => {
        // A fixed height would force a small table into a large empty box.
        const style = styleFor(500, 220);
        expect(style.maxHeight).toBe("220px");
        expect(style.height).toBe("");
    });

    it("accepts a unitless numeric STRING as pixels", () => {
        // React appends `px` to numbers but passes strings verbatim, so "220"
        // would become invalid CSS and be dropped — no bound, no scrollbar.
        expect(styleFor("100%", "220").maxHeight).toBe("220px");
    });

    it("passes a string with a unit through untouched", () => {
        const style = styleFor("50%", "30vh");
        expect(style.maxWidth).toBe("50%");
        expect(style.maxHeight).toBe("30vh");
    });

    it("scrolls, so a bounded viewport clips the table", () => {
        const css = readFileSync(
            "src/views/spreadsheet-view/SpreadsheetView.css",
            "utf8",
        );
        expect(css).toMatch(/overflow:\s*auto/);
    });
});

describe("without a selection controller", () => {
    it("still renders and reports clicks", () => {
        const clicks: string[] = [];
        render(
            <SpreadsheetView<Sheet>
                data={{ rows: 3, cols: 2 }}
                getRowCount={(d) => d.rows}
                getColumnCount={(d) => d.cols}
                getCell={(_d, row, col): CellDescriptor => ({ value: `${row}.${col}` })}
                onCellClick={(row, col) => clicks.push(`${row}:${col}`)}
                viewportWidth={400}
                viewportHeight={300}
            />,
        );
        fireEvent.click(screen.getAllByRole("gridcell")[0]);
        expect(clicks).toEqual(["0:0"]);
        expect(document.querySelectorAll(".selection-range")).toHaveLength(0);
    });
});
