import { useCallback, useState, type DragEvent } from "react";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `useDragReorder` encapsulates the mechanics of drag-to-reorder for the tab
 * bar: reordering items inside a *single* ordered list addressed by index,
 * using the native HTML5 drag-and-drop API.
 *
 * This is a REORDER helper, not a general drag-and-drop framework — hence it
 * lives here beside `TabBar` rather than in a shared `lib/`. It intentionally
 * does not handle cross-container drags, insert-before/after drop positions,
 * touch/pointer dragging, custom drag previews, or non-reorder drop semantics.
 * If those are ever needed, reach for a dedicated DnD library instead of
 * growing this file.
 *
 * DESIGN
 * ------
 * The hook owns ALL the transient drag state and ALL the native-event fiddliness
 * (preventDefault to allow drops, effect hints, reset on drop/end). The
 * coordinator gets back:
 *   - `getDragProps(index)` — a bundle of DOM props to spread onto the element
 *      rendered at `index`, so the coordinator never writes onDragOver/onDrop.
 *   - `isDropTarget(index)` — for styling the current hover target.
 *   - `dragIndex` / `isDragging` — for optional visual feedback.
 *
 * The coordinator supplies exactly one high-level intent: `onReorder(from, to)`.
 */

/** DOM props produced per item; spread these onto the draggable element. */
export interface DragReorderProps {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: (e: DragEvent) => void;
}

export interface UseDragReorderOptions {
    /**
     * High-level intent fired once, when a drag completes onto a different
     * index. Receives source and destination positions in the list.
     */
    onReorder?: (fromIndex: number, toIndex: number) => void;
    /** When false, produced props are inert (dragging disabled). Default true. */
    enabled?: boolean;
}

export interface UseDragReorderResult {
    /** Build the DOM props for the item rendered at `index`. */
    getDragProps: (index: number) => DragReorderProps;
    /** True when `index` is the current hover target of an in-flight drag. */
    isDropTarget: (index: number) => boolean;
    /** The index currently being dragged, or null when idle. */
    dragIndex: number | null;
    /** Convenience flag: is a drag currently in progress? */
    isDragging: boolean;
}

export function useDragReorder(
    options: UseDragReorderOptions = {},
): UseDragReorderResult {
    const { onReorder, enabled = true } = options;

    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const reset = useCallback(() => {
        setDragIndex(null);
        setDragOverIndex(null);
    }, []);

    const getDragProps = useCallback(
        (index: number): DragReorderProps => ({
            draggable: enabled,
            onDragStart: (e) => {
                if (!enabled) {
                    e.preventDefault();
                    return;
                }
                setDragIndex(index);
                if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
            },
            onDragOver: (e) => {
                if (!enabled || dragIndex === null) return;
                // Must preventDefault for the element to be a valid drop target.
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
            },
            onDrop: (e) => {
                if (!enabled) return;
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                    onReorder?.(dragIndex, index);
                }
                reset();
            },
            onDragEnd: () => {
                reset();
            },
        }),
        [enabled, dragIndex, onReorder, reset],
    );

    const isDropTarget = useCallback(
        (index: number) => dragOverIndex === index && dragIndex !== index,
        [dragOverIndex, dragIndex],
    );

    return {
        getDragProps,
        isDropTarget,
        dragIndex,
        isDragging: dragIndex !== null,
    };
}
