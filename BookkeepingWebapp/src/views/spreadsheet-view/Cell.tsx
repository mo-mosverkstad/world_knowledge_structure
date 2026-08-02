import { type ReactNode } from "react";
import "./Cell.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * Cell owns the markup of a single cell
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
            // No `preventDefault` here: a double-click's text selection is
            // started by the browser on the second mousedown, so by the time
            // `dblclick` fires there is no default action left to cancel
            // (measured). `user-select: none` in Cell.css is what suppresses it.
            onDoubleClick={() => {
                if (editable) onBeginEdit();
            }}
        >
            <span className="cell__value">{value}</span>
        </td>
    );
}
