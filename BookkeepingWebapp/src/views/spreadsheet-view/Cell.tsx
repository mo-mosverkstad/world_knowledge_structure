import { type ReactNode, useEffect, useRef } from "react";
import "./Cell.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `Cell` owns the markup of a *single* cell and nothing else. Like the tab
 * bar's `Tab`, its job is to hide raw HTML from the coordinator and translate
 * low-level DOM events into high-level semantic ones:
 *
 *   raw onClick                 ->  onSelect
 *   raw dblclick / Enter / F2   ->  onBeginEdit
 *   editor input                ->  onDraftChange
 *   editor Enter / blur         ->  onCommitEdit
 *   editor Escape               ->  onCancelEdit
 *
 * When `editing` is true it renders an <input>; otherwise it renders the value.
 * It knows nothing about the data model.
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
    editing: boolean;
    editable: boolean;
    align?: "left" | "center" | "right";
    className?: string;
    tooltip?: string;
    /** Current draft text while editing. */
    draft: string;

    // ---- High-level semantic events ------------------------------------
    onSelect: () => void;
    onBeginEdit: () => void;
    onDraftChange: (value: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
}

export function Cell(props: CellProps) {
    const {
        value,
        active,
        editing,
        editable,
        align,
        className,
        tooltip,
        draft,
        onSelect,
        onBeginEdit,
        onDraftChange,
        onCommitEdit,
        onCancelEdit,
    } = props;

    const inputRef = useRef<HTMLInputElement>(null);

    // Focus + select the editor as soon as editing begins.
    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const classes = ["cell"];
    if (active) classes.push("cell--active");
    if (editing) classes.push("cell--editing");
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
            onClick={() => onSelect()}
            onDoubleClick={() => {
                if (editable) onBeginEdit();
            }}
        >
            {editing ? (
                <input
                    ref={inputRef}
                    className="cell__editor"
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onBlur={() => onCommitEdit()}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            onCommitEdit();
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            onCancelEdit();
                        }
                        // Keep keystrokes inside the editor.
                        e.stopPropagation();
                    }}
                />
            ) : (
                <span className="cell__value">{value}</span>
            )}
        </td>
    );
}
