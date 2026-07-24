import { type ReactNode } from "react";
import { type DragReorderProps } from "./useDragReorder";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `Tab` owns the markup of a *single* tab and nothing else. Its whole reason to
 * exist is to hide the raw HTML from {@link TabBar} and to translate low-level
 * DOM events into the high-level, semantic events a behavior coordinator cares
 * about:
 *
 *   raw onClick / Enter / Space   ->  onSelect
 *   raw × button click            ->  onClose   (and swallows the bubbling click
 *                                                so it never doubles as a select)
 *
 * Drag-to-reorder wiring is NOT hand-written here. The reorder hook
 * (`./useDragReorder`) produces a bundle of DOM drag props which the coordinator
 * passes down as `dragProps`; `Tab` simply spreads them onto its root element.
 * The `dropTarget` flag (also derived by the hook) drives styling only.
 *
 * The props mirror exactly the presentation properties the coordinator decided
 * on. Changing how a tab looks or which DOM element it uses stays inside this
 * file.
 */
export interface TabProps {
    title: ReactNode;
    active: boolean;
    disabled?: boolean;
    /** Whether to render the close (×) affordance. */
    closable?: boolean;
    /** Whether this tab is currently the drop target during a drag. */
    dropTarget?: boolean;
    /**
     * DOM drag props produced by the reorder hook, spread onto the root. When
     * omitted, the tab is not draggable.
     */
    dragProps?: DragReorderProps;

    // ---- High-level semantic events (raw DOM events are wrapped away) --
    /** The user chose this tab (click or keyboard activation). */
    onSelect: () => void;
    /** The user requested to close this tab (via the × affordance). */
    onClose?: () => void;
}

export function Tab(props: TabProps) {
    const {
        title,
        active,
        disabled = false,
        closable = false,
        dropTarget = false,
        dragProps,
        onSelect,
        onClose,
    } = props;

    const classes = ["tab"];
    if (active) classes.push("tab--active");
    if (disabled) classes.push("tab--disabled");
    if (dropTarget) classes.push("tab--drop-target");

    // A disabled tab must never be draggable, regardless of incoming props.
    const resolvedDragProps =
        dragProps && !disabled ? dragProps : undefined;

    return (
        <div
            className={classes.join(" ")}
            role="tab"
            aria-selected={active}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            {...resolvedDragProps}
            // ---- raw -> semantic translations --------------------------
            onClick={() => {
                if (!disabled) onSelect();
            }}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            <span className="tab__title">{title}</span>
            {closable && (
                <button
                    type="button"
                    className="tab__close"
                    aria-label="Close tab"
                    onClick={(e) => {
                        // Swallow the click so it does not bubble up and also
                        // trigger a select on the parent tab.
                        e.stopPropagation();
                        onClose?.();
                    }}
                >
                    ×
                </button>
            )}
        </div>
    );
}
