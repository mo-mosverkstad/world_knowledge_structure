import { type ReactNode } from "react";
import "./Cell.css";

export interface CellProps {
    value: ReactNode;
    editable: boolean;
    multiline?: boolean;
    align?: "left" | "center" | "right";
    className?: string;
    tooltip?: string;
    /** Published so the selection overlay can find and measure this cell. */
    row: number;
    col: number;

    onSelect: () => void;
    onBeginEdit: () => void;
    /** `additive` reflects Ctrl/Cmd. */
    onPointerDown?: (additive: boolean) => void;
    onPointerEnter?: () => void;
}

/** One `<td>`: display and event translation only. */
export function Cell(props: CellProps) {
    const {
        value,
        editable,
        multiline = false,
        align,
        className,
        tooltip,
        row,
        col,
        onSelect,
        onBeginEdit,
        onPointerDown,
        onPointerEnter,
    } = props;

    const classes = ["cell"];
    if (multiline) classes.push("cell--multiline");
    if (className) classes.push(className);

    return (
        <td
            className={classes.join(" ")}
            style={align ? { textAlign: align } : undefined}
            // A <td> maps to `cell`; `gridcell` is the interactive counterpart.
            role="gridcell"
            title={tooltip}
            data-row={row}
            data-col={col}
            onMouseDown={(event) => {
                if (event.button !== 0) return;
                onPointerDown?.(event.ctrlKey || event.metaKey);
            }}
            onMouseEnter={() => onPointerEnter?.()}
            onClick={() => onSelect()}
            // No preventDefault: the double-click's text selection starts on the
            // second mousedown, so there is nothing left to cancel by now.
            // `user-select: none` in Cell.css handles it.
            onDoubleClick={() => {
                if (editable) onBeginEdit();
            }}
        >
            <span className="cell__value">{value}</span>
        </td>
    );
}
