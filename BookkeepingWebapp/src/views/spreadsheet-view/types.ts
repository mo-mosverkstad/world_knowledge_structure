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
    /**
     * Per-cell override of the view's `multiline` prop. When omitted, the
     * view's `multiline` decides.
     *
     * This is a per-COLUMN decision in practice: a description cell may want
     * wrapped prose, while the amount and date beside it must stay single-line
     * so a stray newline cannot reach a numeric parser.
     */
    multiline?: boolean;
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
    /**
     * Optional label for the row gutter (the numbered strip on the left).
     * Defaults to `row + 1`, i.e. the row's VISIBLE POSITION.
     *
     * That default is right for a flat sheet, where row 5 *is* the fifth row.
     * It is wrong wherever rows can be hidden: collapse a tree node and every
     * row below it renumbers, so the gutter reshuffles even though those rows
     * did not move. Measured on the hierarchical demo: "Liabilities" showed as
     * row 8 expanded and row 2 collapsed.
     *
     * Supplying this lets the caller number rows by IDENTITY instead of
     * position — a stable ordinal assigned over the whole data set — so
     * collapsing hides numbers rather than renumbering the survivors:
     *
     *     1, 2, 3, 4, 5, 8, 11      not      1, 2, 3, 4, 5, 6, 7
     *
     * Only consulted when the gutter is shown, which today means when
     * `getColumnHeader` is supplied.
     */
    getRowHeader?: (data: TData, row: number) => ReactNode;
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

    // ---- EDIT LIFECYCLE -------------------------------------------------
    /**
     * Fired when an edit BEGINS, with the address being edited. Optional.
     *
     * Why this exists: a `(row, col)` pair is not a stable address. Any change
     * that reorders or removes rows — collapsing a tree node, filtering, sorting,
     * deleting — leaves the remembered edit address pointing at a DIFFERENT
     * value. Committing then writes to the wrong place, silently.
     *
     * The component cannot detect this: to it, row 2 is row 2. Only the caller
     * knows what identifies a row (a path, a primary key, a document id). So a
     * caller whose row set can change under an open edit should record the
     * identity here and compare it in {@link SpreadsheetViewProps.onCellEdit},
     * discarding the edit if it no longer matches.
     *
     * Callers with a fixed row set can ignore this entirely.
     */
    onEditBegin?: (row: number, col: number, data: TData) => void;

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
    /**
     * Allow cell values to contain line breaks. Per-cell override via
     * {@link CellDescriptor.multiline}. Default: false.
     *
     * Two things change when this is on:
     *
     *   - the inline editor becomes a `<textarea>`, because an `<input>`
     *     silently discards newlines — assigning `"a\nb"` to one yields
     *     `"ab"`, so no amount of key handling can make it hold a line break;
     *   - the committed value renders with `white-space: pre-wrap`, so stored
     *     newlines are shown instead of being collapsed into spaces.
     *
     * Key bindings while editing (`Alt+Enter` only applies when multiline):
     *
     *     Enter       commit
     *     Escape      abandon
     *     Alt+Enter   insert a line break at the caret
     *
     * Enter keeps meaning "commit" rather than "new line" because that is what
     * a grid user expects: the common action gets the unmodified key, and the
     * rarer one takes the modifier. It matches Excel.
     */
    multiline?: boolean;

    // ---- SIZING & OVERFLOW ---------------------------------------------
    /**
     * Maximum size of the scroll viewport. A `number` is taken as pixels
     * (matching React's `style` convention); a `string` is passed through to CSS
     * verbatim, so relative and computed units all work:
     *
     *   maxWidth={600}                        →  max-width: 600px
     *   maxWidth="80%"                        →  max-width: 80%
     *   maxHeight="60vh"                      →  max-height: 60vh
     *   maxHeight="clamp(200px, 50vh, 700px)" →  as written
     *
     * Rows and columns stack up to that size; beyond it the grid scrolls.
     *
     * These bounds are not only cosmetic — the floating cell editor grows only
     * as far as the VISIBLE region allows (see the size ladder in the README),
     * so the viewport size decides where the editor stops widening and starts
     * wrapping.
     *
     * A percentage resolves against the containing block, so the parent needs a
     * definite size for `"80%"` to mean what you expect. Defaults:
     * `maxWidth: "100%"` and `maxHeight: 480`.
     */
    maxWidth?: number | string;
    /** See {@link SpreadsheetViewProps.maxWidth}. */
    maxHeight?: number | string;

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
