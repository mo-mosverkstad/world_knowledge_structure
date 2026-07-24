import { type ReactNode } from "react";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `Tabs` owns the markup of the tab *container* (the strip that holds the row
 * of {@link Tab} elements) and nothing else. It exists so that {@link TabBar}
 * never has to know what element wraps the tabs or which ARIA role/classes it
 * carries. The individual `Tab` elements are passed in as `children`, keeping
 * composition — not construction — the coordinator's job.
 *
 * Changing the container element, its layout, or its class names stays entirely
 * inside this file.
 */
export interface TabsProps {
    children: ReactNode;
    /** Optional extra class name for the container. */
    className?: string;
}

export function Tabs({ children, className }: TabsProps) {
    return (
        <div
            className={className ? `tabs ${className}` : "tabs"}
            role="tablist"
        >
            {children}
        </div>
    );
}
