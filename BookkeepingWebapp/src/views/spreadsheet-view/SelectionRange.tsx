import "./SelectionRange.css";

export interface Box {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface SelectionRangeProps {
    box: Box;
    /** Outlined, when the cell that receives typing is inside this range. */
    activeCellBox?: Box;
}

/** One selected block, drawn as a box over the table instead of styling cells. */
export function SelectionRange({ box, activeCellBox }: SelectionRangeProps) {
    return (
        <>
            <div className="selection-range" style={box} aria-hidden="true" />
            {activeCellBox && (
                <div
                    className="selection-range__active-cell"
                    style={activeCellBox}
                    aria-hidden="true"
                />
            )}
        </>
    );
}
