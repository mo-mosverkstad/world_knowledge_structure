import { type ReactNode, type Ref } from "react";
import "./Tabs.css";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `Tabs` owns the markup of the tab *container* (the strip that holds the row
 * of {@link Tab} elements) and nothing else. It exists so that {@link TabBar}
 * never has to know what element wraps the tabs or which ARIA role/classes it
 * carries. The individual `Tab` elements are passed in as `children`, keeping
 * composition — not construction — the coordinator's job.
 *
 * It is also the horizontal SCROLL VIEWPORT: `Tabs.css` gives it the overflow
 * behavior, and `maxWidth` decides where that overflow starts. The coordinator
 * needs a handle on this element to reveal the active tab, which is the only
 * reason a `ref` is accepted.
 *
 * Changing the container element, its layout, or its class names stays entirely
 * inside this file.
 */
export interface TabsProps {
    children: ReactNode;
    /** Optional extra class name for the container. */
    className?: string;
    /**
     * Maximum width of the strip. A number is pixels; a string is used verbatim
     * so `%`, `vw`, `clamp()` etc. all work. Beyond it the strip scrolls.
     */
    maxWidth?: number | string;
    /** Handle on the scroll viewport, used to reveal the active tab. */
    ref?: Ref<HTMLDivElement>;
}

export function Tabs({ children, className, maxWidth, ref }: TabsProps) {
    return (
        <div
            ref={ref}
            className={className ? `tabs ${className}` : "tabs"}
            role="tablist"
            // Inline because the value is per-instance data, not a style rule.
            // A bare number becomes px, matching React's own `style` handling.
            style={maxWidth !== undefined ? { maxWidth } : undefined}
        >
            {children}
        </div>
    );
}
