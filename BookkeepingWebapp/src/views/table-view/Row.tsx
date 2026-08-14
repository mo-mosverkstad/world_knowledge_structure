import { type ReactNode } from "react";
import "./Row.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `Row` owns the markup of a single grid row: a native `<tr>` holding the cells
 * passed as `children`. It exists so the coordinator never has to know what
 * element wraps a row or which ARIA role it carries.
 *
 * The row header is a `<th scope="row">`, not a styled `div`: `scope` is what
 * makes it a *header for this row* rather than merely a cell that happens to sit
 * on the left, so assistive technology can announce "row 3" when reading a cell.
 * The equivalent with `div`s is an explicit `role="rowheader"` — a claim about
 * the markup rather than a property of it.
 */
export interface RowProps {
    children: ReactNode;
    /** Optional row header (e.g. the 1-based row number). */
    header?: ReactNode;
}

export function Row({ children, header }: RowProps) {
    return (
        <tr className="row">
            {header !== undefined && (
                <th scope="row" className="row__header">
                    {header}
                </th>
            )}
            {children}
        </tr>
    );
}
