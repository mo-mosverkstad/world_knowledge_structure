/**
 * Public front door for the spreadsheet-view module.
 *
 * Only the coordinator component and its data contract are exported. The
 * internal helpers — `Grid`, `Row`, `Cell`, `useSelection`, `useEditing` —
 * stay private to this directory so their composition can change freely (and,
 * later, so a viewport/layout engine can be slotted in without touching this
 * public API).
 */
export { SpreadsheetView, default } from "./SpreadsheetView";
export type {
    SpreadsheetViewProps,
    CellDescriptor,
    CellAddress,
} from "./types";
