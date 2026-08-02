import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `useReturnFocus` has exactly one job: when the inline editor closes, make sure
 * keyboard focus is still somewhere that can receive navigation keys.
 *
 * THE BUG IT FIXES
 * ----------------
 * `Cell` focuses its `<input>` when editing begins. Committing (Enter, or blur)
 * or cancelling (Escape) unmounts that input — and when the focused element is
 * removed from the document, the browser has nowhere to put focus, so it falls
 * back to `<body>`. Measured:
 *
 *     F2            focus: INPUT.cell__editor
 *     Enter commit  focus: BODY          <- focus lost here
 *     ArrowDown     focus: BODY          <- keydown never reaches the grid
 *
 * The arrow keys were not broken; the handler simply stopped receiving events,
 * because it lives on the grid container and `<body>` is not inside it. Editing
 * one cell therefore killed keyboard navigation for the rest of the session.
 *
 * This is the standard *focus restoration* pattern — the same obligation a modal
 * dialog has to return focus to whatever opened it. A transient element that
 * takes focus must give it back when it goes away.
 *
 * OBSERVED, NOT CALLED
 * --------------------
 * Nothing asks this hook to restore focus. It watches `isEditing` and reacts to
 * the `true -> false` transition, which keeps focus management decoupled from
 * editing:
 *
 *     coupled                          decoupled (this hook)
 *     commit() {                       useLayoutEffect(() => {
 *         setEditingCell(null);            if (wasEditing && !isEditing)
 *         container.focus();  <- the           container.focus();
 *     }                       editor      }, [isEditing]);
 *                             knows
 *                             about focus
 *
 * Both behave the same for Enter. The observing form also covers Escape, blur,
 * and any future way of ending an edit, because there is no call site that has to
 * remember to restore focus. `useEditing` stays a pure state container with no
 * knowledge of the DOM, and `Cell` needs no ref plumbing.
 *
 * A LAYOUT effect, so focus lands in the same frame the editor disappears. With
 * a passive effect there is a window in which the document has no focused
 * element, which screen readers and browsers can both react to.
 */

export interface UseReturnFocusOptions {
    /** The element that owns the keyboard handler — where focus belongs at rest. */
    containerRef: RefObject<HTMLElement | null>;
    /** True while the inline editor is open. THE trigger: `true -> false`. */
    isEditing: boolean;
    /** When false the hook does nothing. Default true. */
    enabled?: boolean;
}

/**
 * Has focus been *lost* rather than deliberately moved?
 *
 * This distinction is what keeps the hook from stealing focus. Committing by
 * blur means the user clicked something else, and that something else is now
 * focused — pulling focus back to the grid would fight the user, which is the
 * usual way focus-restoration code goes wrong. Focus is only restored when it
 * has genuinely fallen on the floor: `<body>`, the root element, or nothing.
 */
function focusWasLost(): boolean {
    const active = document.activeElement;
    return (
        active === null ||
        active === document.body ||
        active === document.documentElement
    );
}

export function useReturnFocus(options: UseReturnFocusOptions): void {
    const { containerRef, isEditing, enabled = true } = options;

    // Read through a ref so toggling `enabled` alone cannot move focus; only a
    // genuine end-of-edit may.
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const wasEditing = useRef(isEditing);

    useLayoutEffect(() => {
        const was = wasEditing.current;
        wasEditing.current = isEditing;

        // Only the closing transition matters. Opening an editor is `Cell`'s job.
        if (!was || isEditing) return;
        if (!enabledRef.current) return;
        if (!focusWasLost()) return;

        // `preventScroll`: restoring focus must not also scroll the grid, which
        // would move the view for a reason the user did not ask for.
        containerRef.current?.focus({ preventScroll: true });
        // Intentionally ONE dependency: the editing transition.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);
}
