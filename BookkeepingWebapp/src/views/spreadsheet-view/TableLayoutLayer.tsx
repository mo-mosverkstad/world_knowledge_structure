import { TableView, type LayoutCell, type TableViewProps } from "../table-view";

export type { LayoutCell };

/**
 * The props of the layer are the props of the view: a layer that added or renamed
 * one would be a place where a caller has to know which of the two it is talking
 * to.
 */
export type TableLayoutLayerProps<TData> = TableViewProps<TData>;

/**
 * The spreadsheet's table layer. Every view layer in this component ends in
 * `Layer`, and `TableView` deliberately holds no behaviour — so this is the seam
 * where table-level behaviour (dirty-mark rendering, virtualization) will be
 * added, expressed as callbacks handed down to the view.
 *
 * Until then it forwards its props verbatim.
 */
export function TableLayoutLayer<TData>(props: TableLayoutLayerProps<TData>) {
    console.log("TableLayoutLayer rendered");
    return <TableView<TData> {...props} />;
}
