import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./CellEditor.css";
import { type ContentMetrics, type EditorGeometry } from "./useEditorGeometry";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `CellEditor` is the floating edit box: ONE instance, positioned over whichever
 * cell is being edited, living outside the table's layout flow.
 *
 * WHY IT IS NOT INSIDE THE CELL
 * -----------------------------
 * It used to be. An element inside a `<td>` is sized by the table layout
 * algorithm, so it cannot exceed its column, cannot overlay neighbouring cells,
 * and cannot have a height independent of its row. The growth behaviour this
 * component implements is therefore not expressible inside a cell at all.
 *
 * A second benefit falls out of the same move: the draft text no longer has to be
 * broadcast to every `Cell`, so typing stops re-rendering the grid. Measured
 * before: 102 `getCell` calls across 50 distinct cells per keystroke. After: none.
 *
 * SIZE: A FOUR-RUNG LADDER
 * ------------------------
 * See `editorLadder.ts` for the arithmetic. Briefly: fit the cell, else grow
 * rightwards over neighbouring columns, else stop at the visible edge and wrap
 * downwards, else stop at the bottom and scroll.
 *
 * MEASURING THE CONTENT
 * ---------------------
 * Rung 2 needs to know how wide the text would be if it were never wrapped, and a
 * `<textarea>` cannot report that: it only knows the width it has been given. So a
 * hidden MIRROR element holds the same text with the same font and no wrapping,
 * and its `scrollWidth` is the natural width. This is the standard auto-sizing
 * technique, and the mirror is `aria-hidden` so it is never announced twice.
 */
export interface CellEditorProps {
    /** Measured placement and resolved size. */
    geometry: EditorGeometry;
    /**
     * The value to open with. Read ONCE, on mount — the draft is owned here
     * afterwards, which is what keeps typing from re-rendering the grid.
     */
    initialDraft: string;
    /** Whether line breaks are allowed in this cell. */
    multiline: boolean;
    align?: "left" | "center" | "right";
    /** Report what the content wants, so the ladder can be re-resolved. */
    onContentMetrics: (metrics: ContentMetrics) => void;

    /** Commit the given value. The editor owns the text, so it supplies it. */
    onCommitEdit: (value: string) => void;
    onCancelEdit: () => void;
}

/**
 * Insert a line break at the caret, returning the resulting value.
 *
 * `setRangeText` rather than string splicing: hand-splicing loses the caret,
 * because the browser has already applied the value and put the caret at the end
 * (measured: caret 12 instead of 6 in `"hello| world"`). This edits the text and
 * moves the caret in one step, keeping the DOM the single source of truth.
 *
 * The selection is COLLAPSED to its end rather than replaced. The editor opens
 * with its whole value selected so that typing overwrites it, as a grid should —
 * and with a replacing insert, the very first Alt+Enter destroyed the entire cell
 * value and left a bare newline. Collapsing is also the safer reading of the
 * gesture: Alt+Enter adds a line, it never deletes text.
 */
function insertLineBreak(el: HTMLTextAreaElement): string {
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText("\n", end, end, "end");
    return el.value;
}

export function CellEditor(props: CellEditorProps) {
    const {
        geometry,
        initialDraft,
        multiline,
        align,
        onContentMetrics,
        onCommitEdit,
        onCancelEdit,
    } = props;

    // THE DRAFT LIVES HERE. Keeping it in the coordinator meant every keystroke
    // re-rendered the whole grid. Owning it in the only component that needs it
    // makes typing cost independent of grid size.
    const [draft, setDraft] = useState(initialDraft);

    const ref = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);

    // Focus and select on open. Selecting all means typing replaces the value,
    // which is what a grid editor should do.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.select();
        // Only on mount: re-selecting on every keystroke would fight the user.
    }, []);

    // Measure the content after every draft change, BEFORE paint, so the box is
    // never seen at the wrong size. `scrollWidth` on the unwrapped mirror is the
    // natural width; `scrollHeight` on the real textarea is what the text needs at
    // the width it currently has.
    useLayoutEffect(() => {
        const mirror = mirrorRef.current;
        const el = ref.current;
        if (!mirror || !el) return;
        onContentMetrics({
            naturalWidth: mirror.scrollWidth,
            contentHeight: el.scrollHeight,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft, geometry.width]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Alt+Enter is checked FIRST, otherwise the commit branch swallows it and
        // a line break could never be typed.
        if (e.key === "Enter" && e.altKey) {
            e.preventDefault();
            // Inert in a single-line cell, deliberately not falling through to
            // commit: a modifier slip must not silently save the edit, and a
            // stray newline must not reach a value the caller parses as a number.
            if (multiline) setDraft(insertLineBreak(e.currentTarget));
        } else if (e.key === "Enter") {
            e.preventDefault();
            onCommitEdit(e.currentTarget.value);
        } else if (e.key === "Escape") {
            e.preventDefault();
            onCancelEdit();
        }
        // Keep keystrokes out of the grid's own navigation handler.
        e.stopPropagation();
    };

    const classes = ["cell-editor"];
    // Wrapping is decided by the LADDER, not by the multiline prop: a long
    // single-line value that has run out of horizontal room must fold too, or it
    // would scroll sideways and hide its own start.
    if (geometry.wrap) classes.push("cell-editor--wrap");
    if (multiline) classes.push("cell-editor--multiline");

    return (
        <>
            {/*
             * Always a <textarea>, even for single-line cells: an <input> silently
             * DISCARDS newlines (`"a\nb"` becomes `"ab"`, measured), so it could
             * never host a multiline draft. One element keeps the caret and key
             * handling identical in both modes; `multiline` gates the newline
             * binding rather than the element.
             */}
            <textarea
                ref={ref}
                className={classes.join(" ")}
                style={{
                    left: geometry.left,
                    top: geometry.top,
                    width: geometry.width,
                    height: geometry.height,
                    minHeight: geometry.minHeight,
                    // Rung 4: only scroll once growth has genuinely stopped.
                    overflowY: geometry.scroll ? "auto" : "hidden",
                    textAlign: align,
                }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => {
                    // A blur is only a commit when focus moved to ANOTHER element.
                    // Focus leaving the document is not an edit decision — and on
                    // Windows/Linux, pressing Alt hands focus to the browser menu
                    // bar, which used to commit the edit the instant Alt went down
                    // and made Alt+Enter impossible to type.
                    if (e.relatedTarget === null) return;
                    onCommitEdit(e.currentTarget.value);
                }}
                onKeyDown={onKeyDown}
            />
            {/*
             * The measuring mirror. A <textarea> can only report the width it was
             * given, so it cannot say how wide it WANTS to be — which is exactly
             * what rung 2 needs. This holds the same text with the same font and
             * no wrapping, and its scrollWidth is that answer.
             */}
            <div
                ref={mirrorRef}
                className="cell-editor__mirror"
                aria-hidden="true"
            >
                {draft}
            </div>
        </>
    );
}
