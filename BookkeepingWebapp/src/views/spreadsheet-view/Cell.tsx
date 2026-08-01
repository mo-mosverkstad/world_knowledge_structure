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
 *   editor Alt+Enter            ->  a line break, handled entirely in here
 *
 * When `editing` is true it renders an editor; otherwise it renders the value.
 * It knows nothing about the data model.
 *
 * The element is a native `<td>`, so column alignment and width come from the
 * table's own layout algorithm (see `Grid`) instead of from a per-cell `width`.
 * `role="gridcell"` is nevertheless set explicitly: a `<td>` maps to the ARIA
 * role `cell` — verified, not assumed — and `cell` is the static-table role,
 * while `gridcell` is the interactive one. The element gives us layout; the role
 * still has to state the interaction contract.
 *
 * MULTILINE
 * ---------
 * `multiline` switches the editor element from `<input>` to `<textarea>`. That is
 * not cosmetic: an `<input>` *silently discards* newlines. Assigning `"a\nb"` to
 * one yields `"ab"` (measured), so no key handling could make it hold a line
 * break. Only the element choice can.
 *
 * Line breaks are inserted with `setRangeText`, not by splicing the draft string
 * by hand. Hand-splicing loses the caret: the browser has already applied the new
 * value and put the caret at the end, so typing a break in the middle of a word
 * jumps to the end of the text (measured: caret 12 instead of 6 in
 * `"hello| world"`). `setRangeText` performs the edit *and* moves the caret in one
 * step, and because the resulting DOM value is then pushed into state unchanged,
 * React has nothing to rewrite and the caret survives the re-render.
 */
export interface CellProps {
    value: ReactNode;
    active: boolean;
    editing: boolean;
    editable: boolean;
    /** Whether this cell's value may contain line breaks. */
    multiline?: boolean;
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

/**
 * Insert a line break at the caret of a text control, then report the resulting
 * value. Returns the new value so the caller can keep controlled state in sync.
 *
 * `setRangeText` is used deliberately over `value.slice(...) + "\n" + ...`:
 * hand-splicing loses the caret, because the browser has already applied the
 * value and put the caret at the end (measured: caret 12 instead of 6 in
 * `"hello| world"`). `setRangeText` edits the text and moves the caret in one
 * step, keeping the DOM the single source of truth for both.
 *
 * COLLAPSE FIRST, DO NOT REPLACE
 * ------------------------------
 * A selection is collapsed to its END before inserting, rather than being
 * overwritten by the break. That matters because the editor opens with its whole
 * value SELECTED (`.select()`, so typing replaces it, as a grid should). With a
 * replacing insert, the very first Alt+Enter destroyed the entire cell value and
 * left just a newline — the common case, and silent data loss.
 *
 * Collapsing is also the safer reading of the gesture: Alt+Enter asks to ADD a
 * line, never to delete text. Deleting has its own keys.
 */
function insertLineBreak(el: HTMLTextAreaElement): string {
    const end = el.selectionEnd ?? el.value.length;
    // start === end: a pure insertion at the selection's end, replacing nothing.
    el.setRangeText("\n", end, end, "end");
    return el.value;
}

export function Cell(props: CellProps) {
    const {
        value,
        active,
        editing,
        editable,
        multiline = false,
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

    // One ref for either element; only one is ever mounted.
    const editorRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

    // Focus + select the editor as soon as editing begins.
    useEffect(() => {
        if (editing && editorRef.current) {
            editorRef.current.focus();
            editorRef.current.select();
        }
    }, [editing]);

    const classes = ["cell"];
    if (active) classes.push("cell--active");
    if (editing) classes.push("cell--editing");
    if (multiline) classes.push("cell--multiline");
    if (className) classes.push(className);

    const style = align ? { textAlign: align } : undefined;

    /**
     * Shared key handling for both editor elements.
     *
     * Order matters: Alt+Enter is checked before plain Enter, otherwise the
     * commit branch would swallow it and a line break could never be typed.
     */
    const onEditorKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        if (e.key === "Enter" && e.altKey) {
            // Never a commit. In a single-line cell it is simply inert, so a
            // stray newline cannot reach a value the caller parses as a number.
            e.preventDefault();
            if (multiline) {
                onDraftChange(
                    insertLineBreak(e.currentTarget as HTMLTextAreaElement),
                );
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            onCommitEdit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onCancelEdit();
        }
        // Keep keystrokes inside the editor.
        e.stopPropagation();
    };

    const editorProps = {
        className: "cell__editor",
        value: draft,
        onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => onDraftChange(e.target.value),
        onBlur: (
            e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
            // A blur is only a commit when the user moved focus to ANOTHER
            // element. Focus leaving the document entirely is not an edit
            // decision, and on Windows/Linux pressing Alt hands focus to the
            // browser menu bar — so Alt+Enter used to blur the editor and
            // commit the draft, making a line break impossible to type.
            if (e.relatedTarget === null) return;
            onCommitEdit();
        },
        onKeyDown: onEditorKeyDown,
    };

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
                multiline ? (
                    <textarea
                        ref={editorRef}
                        // Grows with the draft instead of scrolling a fixed box,
                        // so the whole value stays visible while editing.
                        rows={Math.min(draft.split("\n").length, 8)}
                        {...editorProps}
                    />
                ) : (
                    <input ref={editorRef} {...editorProps} />
                )
            ) : (
                <span className="cell__value">{value}</span>
            )}
        </td>
    );
}
