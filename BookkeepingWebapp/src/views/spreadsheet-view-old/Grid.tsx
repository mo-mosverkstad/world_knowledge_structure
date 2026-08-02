import { type ReactNode, type Ref } from "react";
import "./Grid.css";

/**
 * INTERNAL helper — not part of the spreadsheet public API.
 *
 * `Grid` owns the container markup for the whole sheet: an optional header strip
 * (column headers) plus the body of rows passed as `children`. Changing the
 * container element, its scroll behavior, or its ARIA role stays inside here.
 *
 * WHY A NATIVE `<table>`
 * ----------------------
 * The browser already implements two-dimensional tabular layout, and it does
 * things a stack of flex `div`s cannot do without reimplementing them:
 *
 *   - COLUMN WIDTH IS A COLUMN PROPERTY. A `<col>` sizes an entire column, and
 *     the table's own algorithm keeps every cell in it aligned. With `div` rows,
 *     each cell carries its own width and alignment is a coincidence that has to
 *     be maintained by hand in CSS.
 *   - INTRINSIC SIZING. `width: auto` on a table means "as wide as the widest
 *     content", per column, for free. That is the whole basis of a
 *     resize-to-fit column, which is table-stakes spreadsheet behavior.
 *   - BORDER COLLAPSING. `border-collapse` produces the single-pixel grid lines
 *     a spreadsheet needs; flex rows produce doubled borders between neighbours
 *     unless every edge case is hand-nudged.
 *   - ROW/COLUMN SPANNING. `rowspan`/`colspan` are how merged cells work, and
 *     they are native. Nothing equivalent exists for flex children.
 *   - SEMANTICS AND A11Y FOR FREE. `<th scope="col">` *is* a column header;
 *     `<th scope="row">` *is* a row header. With `div`s these must be asserted
 *     with explicit `role` attributes, which is a promise that the markup is
 *     shaped correctly rather than a guarantee.
 *
 * The wrapper `div` around the table is the SCROLL VIEWPORT: a table cannot both
 * size itself to its content and clip that content, so scrolling and sizing are
 * separated onto two elements. `position: sticky` on the header cells then works
 * against that scroll container, which is what keeps headers frozen.
 *
 * `role="grid"` is kept explicitly on the table. A plain `<table>` is exposed as
 * `role="table"` — a static document structure — whereas `grid` tells assistive
 * technology this is an interactive, focusable, navigable widget. Same element,
 * different promise to the user.
 */
export interface GridProps {
    children: ReactNode;
    /**
     * Optional column-header row rendered above the body. Expected to be a
     * sequence of header cells; `Grid` wraps it in the table's `<thead>`.
     */
    columnHeader?: ReactNode;
    /**
     * Column definitions, rendered as a `<colgroup>`. This is what makes width a
     * property of the COLUMN rather than of each individual cell.
     */
    columns?: ReactNode;
    className?: string;
    /**
     * Floating layers drawn OVER the table: the cell editor, and later a range
     * selection box. Rendered as siblings of the `<table>` inside the scroll
     * container, which is what lets them escape the table's layout flow while
     * still scrolling and clipping with the content.
     */
    overlay?: ReactNode;
    /**
     * Handle on the scroll viewport. The overlay geometry is measured against
     * this element, so the coordinator needs a reference to it.
     */
    scrollRef?: Ref<HTMLDivElement>;
    /**
     * Maximum size of the scroll viewport. A number is pixels; a string is used
     * verbatim so `%`, `vh`, `clamp()` etc. all work. Beyond it the grid scrolls.
     */
    maxWidth?: number | string;
    maxHeight?: number | string;
}

export function Grid({
    children,
    columnHeader,
    columns,
    className,
    overlay,
    scrollRef,
    maxWidth,
    maxHeight,
}: GridProps) {
    return (
        // The scroll viewport. Separate from the table because a table sizes
        // itself to its content and therefore cannot also clip it. It is also
        // the overlay's containing block (`position: relative` in Grid.css), so
        // floating layers scroll with the content and are clipped by it.
        <div
            className="grid"
            ref={scrollRef}
            // Inline because these are per-instance data, not style rules. A
            // bare number becomes px, matching React's own `style` handling.
            style={{ maxWidth, maxHeight }}
        >
            <table
                className={className ? `grid__table ${className}` : "grid__table"}
                // Explicit: a bare <table> is a static `table`, not an
                // interactive `grid`.
                role="grid"
            >
                {columns !== undefined && <colgroup>{columns}</colgroup>}
                {columnHeader !== undefined && (
                    <thead className="grid__head">
                        <tr className="grid__header-row">{columnHeader}</tr>
                    </thead>
                )}
                <tbody className="grid__body">{children}</tbody>
            </table>
            {overlay}
        </div>
    );
}
