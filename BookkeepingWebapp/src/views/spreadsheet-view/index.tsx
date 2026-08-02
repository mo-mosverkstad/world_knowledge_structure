/**
 * Public front door for the spreadsheet-view module.
 *
 * Only the coordinator and its data contract are exported; `Row` and `Cell` stay
 * private so their composition can change freely.
 */
export { SpreadsheetView, default } from "./SpreadsheetView";
export type {
    SpreadsheetViewProps,
    CellDescriptor,
    CellAddress,
} from "./types";
