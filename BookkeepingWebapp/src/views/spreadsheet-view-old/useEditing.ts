import { useCallback, useState } from "react";
import { type CellAddress } from "./types";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `useEditing` owns *which cell is being edited*, and nothing else.
 *
 * WHY THE DRAFT TEXT IS NOT HERE
 * ------------------------------
 * It used to be. That single fact made typing cost O(cells): the draft lived in
 * this hook, this hook lives in the coordinator, so every keystroke re-rendered
 * `SpreadsheetView`, whose render loop calls `getCell` for every cell. Measured on
 * a 50-cell grid: 102 calls across 50 distinct addresses per character typed.
 *
 * Moving the editor out of the table was necessary but not sufficient — the state
 * had to move too. The draft now lives inside `CellEditor`, the only component
 * that needs it, so a keystroke re-renders one element and the table is untouched.
 *
 * The split follows the lifetime of each fact:
 *
 *     which cell is being edited   changes on begin/commit/cancel   -> here
 *     the draft text               changes on every keystroke       -> in the editor
 *
 * `initialDraft` is the seed handed to the editor when it opens. It is set once,
 * at `begin`, and never on a keystroke, so it cannot reintroduce the broadcast.
 *
 * This is deliberately kept inside the renderer rather than pushed to external
 * logical state: an in-progress edit is a transient interaction detail, like
 * `useDragReorder`'s drag bookkeeping in the tab bar.
 */

export interface UseEditingOptions {
    /** Fired when an edit is committed with a final value. */
    onCommit?: (cell: CellAddress, value: string) => void;
}

export interface UseEditingResult {
    /** The cell currently being edited, or null when not editing. */
    editingCell: CellAddress | null;
    /** The value the editor should open with. Set at `begin` only. */
    initialDraft: string;
    /** True when an edit is in progress. */
    isEditing: boolean;
    /** Begin editing a cell, seeding the editor with `initial`. */
    begin: (cell: CellAddress, initial: string) => void;
    /**
     * Commit `value` (fires `onCommit`) and stop editing. The value is passed in
     * by the editor, which owns it — this hook never sees intermediate text.
     */
    commit: (value: string) => void;
    /** Abandon the edit without committing. */
    cancel: () => void;
}

export function useEditing(
    options: UseEditingOptions = {},
): UseEditingResult {
    const { onCommit } = options;

    const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
    const [initialDraft, setInitialDraft] = useState("");

    const begin = useCallback((cell: CellAddress, initial: string) => {
        setEditingCell(cell);
        setInitialDraft(initial);
    }, []);

    const commit = useCallback(
        (value: string) => {
            // The caller is notified OUTSIDE the state updater, deliberately.
            //
            // This used to read `setEditingCell((cell) => { onCommit(cell);
            // return null; })`, which is wrong: React may invoke an updater
            // during the RENDER phase, and may invoke it more than once. So
            // `onCommit` ran mid-render, and a caller that set its own state
            // from it produced React's "Cannot update a component while
            // rendering a different component" warning. An updater must be a
            // pure function of the previous state; side effects do not belong
            // in one.
            //
            // Reading `editingCell` directly is safe because `commit` only ever
            // runs from an event handler, where the current render's value is
            // the one being committed.
            if (editingCell) onCommit?.(editingCell, value);
            setEditingCell(null);
            setInitialDraft("");
        },
        [editingCell, onCommit],
    );

    const cancel = useCallback(() => {
        setEditingCell(null);
        setInitialDraft("");
    }, []);

    return {
        editingCell,
        initialDraft,
        isEditing: editingCell !== null,
        begin,
        commit,
        cancel,
    };
}
