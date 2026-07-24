import { type ReactNode } from "react";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `Tab` owns the markup of a *single* tab and nothing else. Its whole reason to
 * exist is to hide the raw HTML from {@link TabBar} and to translate low-level
 * DOM events (mouse clicks, keydowns, native drag events) into the high-level,
 * semantic events a behavior coordinator actually cares about:
 *
 *   raw onClick / Enter / Space   ->  onSelect
 *   raw × button click            ->  onClose   (and swallows the bubbling click
 *                                                so it never doubles as a select)
 *   raw dragstart/over/drop/end   ->  onReorderStart / onReorderOver /
 *                                     onReorderDrop / onReorderEnd
 *
 * The props mirror exactly the presentation properties the coordinator decided
 * on (active, disabled, closable, draggable, drop-target). Changing how a tab
 * looks or which DOM element it uses stays entirely inside this file.
 */
export interface TabProps {
    title: ReactNode;
    active: boolean;
    disabled?: boolean;
    /** Whether to render the close (×) affordance. */
    closable?: boolean;
    /** Whether this tab may be dragged (reordering enabled). */
    draggable?: boolean;
    /** Whether this tab is currently the drop target during a drag. */
    dropTarget?: boolean;

    // ---- High-level semantic events (raw DOM events are wrapped away) --
    /** The user chose this tab (click or keyboard activation). */
    onSelect: () => void;
    /** The user requested to close this tab (via the × affordance). */
    onClose?: () => void;
    /** A drag of this tab began. */
    onReorderStart?: () => void;
    /** A dragged tab is hovering over this tab. */
    onReorderOver?: () => void;
    /** A dragged tab was dropped onto this tab. */
    onReorderDrop?: () => void;
    /** A drag involving this tab ended (committed or cancelled). */
    onReorderEnd?: () => void;
}

export function Tab(props: TabProps) {
    const {
        title,
        active,
        disabled = false,
        closable = false,
        draggable = false,
        dropTarget = false,
        onSelect,
        onClose,
        onReorderStart,
        onReorderOver,
        onReorderDrop,
        onReorderEnd,
    } = props;

    const classes = ["tab"];
    if (active) classes.push("tab--active");
    if (disabled) classes.push("tab--disabled");
    if (dropTarget) classes.push("tab--drop-target");

    return (
        <div
            className={classes.join(" ")}
            role="tab"
            aria-selected={active}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            draggable={draggable && !disabled}
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
            onDragStart={draggable ? () => onReorderStart?.() : undefined}
            onDragOver={
                draggable
                    ? (e) => {
                          e.preventDefault(); // permit drop
                          onReorderOver?.();
                      }
                    : undefined
            }
            onDrop={
                draggable
                    ? (e) => {
                          e.preventDefault();
                          onReorderDrop?.();
                      }
                    : undefined
            }
            onDragEnd={draggable ? () => onReorderEnd?.() : undefined}
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
