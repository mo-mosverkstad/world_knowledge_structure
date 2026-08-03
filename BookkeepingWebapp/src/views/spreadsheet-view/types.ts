import { type ReactNode } from "react";
import { type SelectionController } from "./SelectionController";

export interface CellAddress {
    row: number;
    col: number;
}

export interface CellDescriptor {
    value: ReactNode;
    /** Overrides the view's `editable`. */
    editable?: boolean;
    align?: "left" | "center" | "right";
    /** Overrides the view's `multiline`. Affects wrapping. */
    multiline?: boolean;
    className?: string;
    tooltip?: string;
}

export interface SpreadsheetViewProps<TData> {
    /** The business data structure. Opaque to the component. */
    data: TData;

    getRowCount: (data: TData) => number;
    getColumnCount: (data: TData) => number;
    getCell: (data: TData, row: number, col: number) => CellDescriptor;

    /** Omit for no header strip / no row gutter. */
    getColumnHeader?: (data: TData, col: number) => ReactNode;
    getRowHeader?: (data: TData, row: number) => ReactNode;

    /**
     * Stable row identity for React's key. Without it the row index is the key, so
     * React matches rows by position rather than by record.
     */
    getRowKey?: (data: TData, row: number) => string | number;

    onCellClick?: (row: number, col: number, data: TData) => void;
    /** Before editing starts, so the caller can capture the record's identity. */
    onEditBegin?: (row: number, col: number, data: TData) => void;

    /**
     * Selection store, created and held by the host (see `useSelectionController`).
     * Omit it and the grid has no selection.
     *
     * A stable reference rather than a value, so selection changes never flow
     * through the render tree and the table is not re-rendered. The host holding it
     * can also drive selection from outside the grid.
     */
    selectionController?: SelectionController;

    editable?: boolean;
    multiline?: boolean;
    className?: string;

    /** Bounds the scroll viewport. A number is pixels; a string is used verbatim. */
    viewportWidth: string | number;
    viewportHeight: string | number;
}
