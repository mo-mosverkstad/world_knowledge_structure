import { type ReactNode } from "react";
import "./ColumnHeader.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `ColumnHeader` owns the markup of a single column-header cell, and `CornerCell`
 * the empty square where the header strip meets the row-number gutter.
 *
 * `<th scope="col">` is what actually MAKES these column headers. `scope` states
 * that the cell labels the column below it, so assistive technology can announce
 * "Amount" when reading a cell further down. A `div` with `role="columnheader"`
 * is an assertion about markup; `<th scope="col">` is a property of it.
 */
export interface ColumnHeaderProps {
    children: ReactNode;
    /** Extra class name, e.g. for a domain-specific header style. */
    className?: string;
}

export function ColumnHeader({ children, className }: ColumnHeaderProps) {
    const classes = className ? `column-header ${className}` : "column-header";
    return (
        <th scope="col" className={classes}>
            {children}
        </th>
    );
}

/**
 * The corner square above the row-number gutter. It labels nothing, so it is a
 * plain `<th>` with NO `scope` — claiming `scope="col"` would tell assistive
 * technology that the gutter's numbers are labelled "empty". `aria-hidden` keeps
 * it out of the accessibility tree entirely.
 */
export function CornerCell() {
    return <th className="column-header__corner" aria-hidden="true" />;
}
