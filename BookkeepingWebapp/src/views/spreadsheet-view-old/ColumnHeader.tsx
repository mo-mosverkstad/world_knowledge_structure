import { type ReactNode } from "react";
import "./ColumnHeader.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `ColumnHeader` owns the markup of a single column-header cell, and `CornerCell`
 * the empty square where the header strip meets the row-number gutter.
 *
 * These exist because the coordinator previously emitted `<div
 * className="grid__col-header">` inline — the one place it broke its own rule of
 * rendering no raw HTML. Behavior coordination and markup were interleaved, so a
 * change of element (exactly what moving to a real `<table>` requires) reached
 * into `SpreadsheetView.tsx` instead of staying in the UI layer.
 *
 * `<th scope="col">` is what actually *makes* these column headers, rather than
 * a `div` asserting `role="columnheader"`.
 */
export interface ColumnHeaderProps {
    children: ReactNode;
    /** Extra class name, e.g. for a domain-specific header style. */
    className?: string;
}

export function ColumnHeader({ children, className }: ColumnHeaderProps) {
    const classes = className
        ? `grid__col-header ${className}`
        : "grid__col-header";
    return (
        <th scope="col" className={classes}>
            {children}
        </th>
    );
}

/**
 * The corner square above the row-number gutter. It labels nothing, so it is a
 * plain `<th>` with no `scope` and is hidden from assistive technology rather
 * than being announced as an empty header.
 */
export function CornerCell() {
    return <th className="grid__corner" aria-hidden="true" />;
}
