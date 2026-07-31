import { useCallback, useState } from "react";
import { type CellAddress } from "./types";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `useEditing` owns the *ephemeral* editing state: which cell (if any) is
 * currently being edited and the in-progress draft value. This is deliberately
 * kept inside the renderer rather than pushed to external logical state — it is
 * a transient interaction detail, like `useDragReorder`'s drag bookkeeping in
 * the tab bar.
 *
 * The coordinator supplies one high-level commit intent, `onCommit(cell, value)`,
 * and gets back small imperative controls (`begin`, `change`, `commit`, `cancel`)
 * plus the current editing address and draft.
 */

export interface UseEditingOptions {
    /** Fired when an edit is committed with a final value. */
    onCommit?: (cell: CellAddress, value: string) => void;
}

export interface UseEditingResult {
    /** The cell currently being edited, or null when not editing. */
    editingCell: CellAddress | null;
    /** The current draft text of the in-progress edit. */
    draft: string;
    /** True when an edit is in progress. */
    isEditing: boolean;
    /** Begin editing a cell with an initial draft value. */
    begin: (cell: CellAddress, initial: string) => void;
    /** Update the draft as the user types. */
    change: (value: string) => void;
    /** Commit the current draft (fires `onCommit`) and stop editing. */
    commit: () => void;
    /** Abandon the edit without committing. */
    cancel: () => void;
}

export function useEditing(
    options: UseEditingOptions = {},
): UseEditingResult {
    const { onCommit } = options;

    const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
    const [draft, setDraft] = useState("");

    const begin = useCallback((cell: CellAddress, initial: string) => {
        setEditingCell(cell);
        setDraft(initial);
    }, []);

    const change = useCallback((value: string) => {
        setDraft(value);
    }, []);

    const commit = useCallback(() => {
        setEditingCell((cell) => {
            if (cell) onCommit?.(cell, draft);
            return null;
        });
        setDraft("");
    }, [onCommit, draft]);

    const cancel = useCallback(() => {
        setEditingCell(null);
        setDraft("");
    }, []);

    return {
        editingCell,
        draft,
        isEditing: editingCell !== null,
        begin,
        change,
        commit,
        cancel,
    };
}
