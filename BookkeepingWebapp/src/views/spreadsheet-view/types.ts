import { type ReactNode } from "react";

/**
 * Public data contract for the spreadsheet view.
 *
 * Like the tab bar, the spreadsheet is *data-driven*: it knows nothing about
 * the shape of your business data. The caller passes an opaque `data` port plus
 * callbacks that read cells out of it and forward mutations back to it. This is
 * classic dependency inversion — the component depends on a small set of
 * operations, not on your `Employee[]` / ledger / matrix / remote source.
 *
 * These types live in their own module so the coordinator (`SpreadsheetView.tsx`)
 * and the front door (`index.tsx`) can share them without pulling in behavior.
 */

/** A cell coordinate. `row` and `col` are 0-based. */
export interface CellAddress {
    row: number;
    col: number;
}

/**
 * The minimal, presentation-facing description of a single cell — the 2D analog
 * of the tab bar's `TabDescriptor`. The caller projects one of these out of its
 * business data on demand via `getCell`; the component never sees the domain
 * object behind it.
 */
export interface CellDescriptor {
    /** What is rendered in the cell. Any node; commonly a string or number. */
    value: ReactNode;
    /**
     * Per-cell override of the view's `editable` prop. When omitted, the view's
     * `editable` decides. Lets the caller pin specific cells read-only.
     */
    editable?: boolean;
    /** Horizontal alignment hint (e.g. numbers right-aligned). */
    align?: "left" | "center" | "right";
    /** Extra class name for the cell (e.g. domain-specific highlighting). */
    className?: string;
    /** Optional native tooltip. */
    tooltip?: string;
}

export interface SpreadsheetViewProps<TData> {
    // ---- DATA PORT -----------------------------------------------------
    /**
     * The business data structure. Opaque to the component; only the callbacks
     * below give it meaning.
     */
    data: TData;

    // ---- ACCESS CALLBACKS (read the data port) -------------------------
    /** Number of rows the data currently exposes. */
    getRowCount: (data: TData) => number;
    /** Number of columns the data currently exposes. */
    getColumnCount: (data: TData) => number;
    /**
     * Project the cell at (`row`, `col`) into a descriptor. Random access is the
     * right primitive for a grid (unlike the tab bar's single-pass iterator): a
     * virtualized spreadsheet asks only for the cells inside the visible
     * rectangle, so O(1) indexed access — not a full traversal — is what pairs
     * well with viewporting. Expected O(1).
     */
    getCell: (data: TData, row: number, col: number) => CellDescriptor;
    /** Optional column header label for column `col`. */
    getColumnHeader?: (data: TData, col: number) => ReactNode;

    // ---- MUTATE CALLBACKS (operate on the data port) -------------------
    /**
     * Requested when the user commits an edit. The caller performs the actual
     * mutation on its own data structure and passes back updated `data` on the
     * next render. When omitted, cells are never editable.
     */
    onCellEdit?: (
        row: number,
        col: number,
        value: string,
        data: TData,
    ) => void;

    // ---- BEHAVIOR HOOKS (caller-defined side effects) ------------------
    /**
     * Fired when a cell is clicked. What "clicking a cell" means is up to the
     * caller — the component only reports it.
     */
    onCellClick?: (row: number, col: number, data: TData) => void;
    /** Fired whenever the active (selected) cell changes. */
    onSelectionChange?: (cell: CellAddress | null, data: TData) => void;

    // ---- CUSTOMIZATION -------------------------------------------------
    /**
     * Allow cells to be edited (double-click / Enter / F2). Per-cell override
     * via `CellDescriptor.editable`. Default: false.
     */
    editable?: boolean;

    // ---- SELECTION CONTROL ---------------------------------------------
    /**
     * Controlled active cell. When provided (including `null`), the component
     * defers to the caller for selection and does not track it internally.
     * This is the seam for keeping *logical* selection state outside the view.
     */
    activeCell?: CellAddress | null;
    /** Initial active cell for the uncontrolled case. */
    defaultActiveCell?: CellAddress;

    /** Optional extra class name for the outer container. */
    className?: string;
}
