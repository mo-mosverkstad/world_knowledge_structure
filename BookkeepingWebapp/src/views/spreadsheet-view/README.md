# Spreadsheet and hierarchial spreadsheet component

## Architecture:

```
Components:
table-view (behavior-less):
  *TableView.tsx + TableView.css
  Cell.tsx + Cell.css
  ColumnHeader.tsx + ColumnHeader.css
  Row.tsx + Row.css

spreadsheet-view (spreadsheet-editor behavior):
  (View must carry both buisness spreadsheet data structure using callback pull + current selection state)
  (update the selection state must be updated during insertion/deletion)
  *SpreadsheetView.tsx + SpreadsheetView.css
  Layer 1:
    *TableLayoutLayer.tsx <- dirty mark rendering, virtualization
  Layer 2:
    SelectionController.ts <- for notifying selection controller
    SelectionRange.tsx + SelectionRange.css <- currently uses naive DOM lookup
    *SelectionRangeLayer.tsx
  Layer 3:
    EditBox.tsx + EditBox.css
    *EditBoxLayer.tsx + EditBoxLayer.css
  ... considering customerizing edits ...
  (useTableGeometry)
  (useEditBox)

hierarchy-spreadsheet-view (hierarchy)
  (Load hierarchial table of buisness data structure using wrapped-callback pull into linear structure which is in turn fed into spreadsheet-view)
  (Business data structure as hierarchial table + path selection range)
  (Path selection range dominates over spreadsheet-view linear selection range (as a derivation))
  ...
```

## Update selection state
The selection state must be manually updated externally, for the cases below (one axis analysis):
- insert: increment all (row, col) if insertion happens above the selection range
- deletion: decrement all (row, col) if deletion happens above the selection range
- If happen in middle of selection: increment only the destination if insertion, decrement if deletion
- Move operation: treated as a deletion of a row + insertion of the same row
- Otherwise: the selection state does not need to be updated

Notice how the operations must be performed for both axis

## Virtualization
During virtualization, only the visible virtualized portion is rendered. Whether the portion is visible or not can be easily probed, using `.getClientBoundingRect` of a DOM element and checking intersection between the positions and the viewport boundaries. Only the visible part is drawn, while leaving the most of the viewport inner space blank.
The tail of the virtualized portion is called virtualized buffer zones. Whenever the viewport intersects with the buffer zones when scrolling, reloading and materializing happens, while virtualization portion moves down by evicting the elements on the other side. Notice that scrolling past the speed of loading may result in temporal waiting section before allowing continuing scrolling.

```
+-----------------------------------------+
|                                         |
|               (empty)                   |
|                                         |
+.........................................+
|       (Virtualized buffer zone)         |
|                                         |
+-----------------------------------------+
|                                         |
|                                         |
|           Virtualized part              |
|            (Visual part)                |
|                                         |
+-----------------------------------------+
|       (Virtualized buffer zone)         |
|                                         |
+.........................................+
|                                         |
|              (empty)                    |
|                                         |
+-----------------------------------------+
```

# Dirty mark rendering
Cells should be re-rendered only on dirty mark...

... mechanism ...