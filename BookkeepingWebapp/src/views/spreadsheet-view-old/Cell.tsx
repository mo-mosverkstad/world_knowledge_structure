import { type ReactNode } from "react";
import "./Cell.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `Cell` owns the markup of a *single* cell and nothing else. Like the tab
 * bar's `Tab`, its job is to hide raw HTML from the coordinator and translate
 * low-level DOM events into high-level semantic ones:
 *
 *   raw onClick     ->  onSelect
 *   raw dblclick    ->  onBeginEdit
 *
 * IT NO LONGER HOSTS THE EDITOR
 * -----------------------------
 * The inline editor used to live in here, which had two costs:
 *
 *   - LAYOUT. An element inside a `<td>` is sized by the table algorithm, so it
 *     could not exceed its column or overlay the rows below. Growing an editor
 *     downward over neighbouring rows was therefore impossible in principle, not
 *     merely awkward.
 *   - INVALIDATION. The draft text had to be passed to EVERY cell, since any cell
 *     might be the edited one. Measured: 100 `getCell` calls per keystroke on a
 *     50-cell grid. Typing cost scaled with the size of the grid.
 *
 * The editor is now a single floating `CellEditor` positioned over the cell (see
 * `CellEditor.tsx`), so this component knows nothing about editing beyond
 * reporting the double-click that starts it. `editing`, `draft` and the three
 * commit/cancel callbacks are all gone from its props.
 *
 * The element is a native `<td>`, so column alignment and width come from the
 * table's own layout algorithm (see `Grid`) instead of from a per-cell `width`.
 * `role="gridcell"` is nevertheless set explicitly: a `<td>` maps to the ARIA
 * role `cell` — verified, not assumed — and `cell` is the static-table role,
 * while `gridcell` is the interactive one. The element gives us layout; the role
 * still has to state the interaction contract.
 */
export interface CellProps {
    value: ReactNode;
    active: boolean;
    /** Whether a double-click should request an edit. */
    editable: boolean;
    /** Whether this cell's value may contain line breaks (affects wrapping). */
    multiline?: boolean;
    align?: "left" | "center" | "right";
    className?: string;
    tooltip?: string;
    /**
     * Grid coordinates, published as `data-` attributes so the editor overlay can
     * MEASURE this cell. Column widths come from `table-layout: auto`, i.e. from
     * the browser, so there is no width to look up — `getBoundingClientRect` on
     * the real element is the only honest source, and that needs a way to find it.
     */
    row: number;
    col: number;
    /** True while this cell is the one being edited (its content is covered). */
    editing?: boolean;

    // ---- High-level semantic events ------------------------------------
    onSelect: () => void;
    onBeginEdit: () => void;
}

export function Cell(props: CellProps) {
    const {
        value,
        active,
        editable,
        multiline = false,
        align,
        className,
        tooltip,
        row,
        col,
        editing = false,
        onSelect,
        onBeginEdit,
    } = props;

    const classes = ["cell"];
    if (active) classes.push("cell--active");
    if (editing) classes.push("cell--editing");
    if (multiline) classes.push("cell--multiline");
    if (className) classes.push(className);

    const style = align ? { textAlign: align } : undefined;

    return (
        <td
            className={classes.join(" ")}
            style={style}
            // A <td> is exposed as `cell` (static); `gridcell` is the
            // interactive counterpart this widget actually implements.
            role="gridcell"
            aria-selected={active}
            title={tooltip}
            tabIndex={active ? 0 : -1}
            data-row={row}
            data-col={col}
            onClick={() => onSelect()}
            onDoubleClick={() => {
                if (editable) onBeginEdit();
            }}
        >
            <span className="cell__value">{value}</span>
        </td>
    );
}
