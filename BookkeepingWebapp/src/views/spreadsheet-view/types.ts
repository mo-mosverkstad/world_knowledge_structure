import { type ReactNode } from "react";

/** A cell position in the grid. */
export interface CellAddress {
    row: number;
    col: number;
}

/**
 * How a single cell should be presented. The caller projects one of these out of
 * its business data on demand via `getCell`; the component never sees the domain
 * type behind it.
 */
export interface CellDescriptor {
    /** What is rendered in the cell. Any node; commonly a string or number. */
    value: ReactNode;
    /** Per-cell override of the view's `editable` prop. */
    editable?: boolean;
    /** Horizontal alignment hint (e.g. numbers right-aligned). */
    align?: "left" | "center" | "right";
    /** Per-cell override of the view's `multiline` prop. Affects wrapping. */
    multiline?: boolean;
    /** Extra class name for the cell. */
    className?: string;
    /** Optional native tooltip. */
    tooltip?: string;
}

export interface SpreadsheetViewProps<TData> {
    // ---- DATA PORT -----------------------------------------------------
    /** The business data structure. Opaque to the component. */
    data: TData;

    // ---- ACCESSORS (random access, one call per rendered cell) ----------
    getRowCount: (data: TData) => number;
    getColumnCount: (data: TData) => number;
    getCell: (data: TData, row: number, col: number) => CellDescriptor;

    /**
     * Optional column header, shown in a frozen strip above the grid. Omit for no
     * header row. Given the column index, so the caller decides whether that
     * means a field name, a spreadsheet letter, or anything else.
     */
    getColumnHeader?: (data: TData, col: number) => ReactNode;

    /**
     * Optional row header, shown in the left gutter. Omit for no gutter.
     * Given the row index so the caller can number rows however it likes.
     */
    getRowHeader?: (data: TData, row: number) => ReactNode;

    /**
     * Optional stable identity for a row, used as the React key. Without it the
     * row index is the key, which makes React match rows by POSITION: insert a
     * row and every row after it is treated as changed.
     */
    getRowKey?: (data: TData, row: number) => string | number;

    // ---- BEHAVIOUR HOOKS -----------------------------------------------
    /** Fired when a cell is clicked. */
    onCellClick?: (row: number, col: number, data: TData) => void;
    /**
     * Fired when the user asks to edit a cell, before any editing starts. The
     * caller can capture the record's identity here, because a row index may
     * name a different record by the time the edit finishes.
     */
    onEditBegin?: (row: number, col: number, data: TData) => void;

    // ---- CUSTOMISATION -------------------------------------------------
    /** Allow cells to be edited. Per-cell `editable` overrides this. */
    editable?: boolean;
    /** Allow cell values to contain line breaks. Per-cell `multiline` overrides. */
    multiline?: boolean;
    /** Optional extra class name for the outer container. */
    className?: string;
}
