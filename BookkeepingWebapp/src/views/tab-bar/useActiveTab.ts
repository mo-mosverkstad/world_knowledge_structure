import { useCallback, useEffect, useRef, useState } from "react";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `useActiveTab` encapsulates the intrinsic "which tab is active" concern of a
 * tab bar, in both controlled and uncontrolled modes:
 *   - remembers the active tab id (uncontrolled) or defers to the caller
 *     (controlled, when `controlledId` is provided);
 *   - exposes `select(id)` for the coordinator to call on a tab activation;
 *   - reconciles the active tab against the current set of tabs each render
 *     (via {@link reconcile}) so a closed/removed active tab falls back to the
 *     first available tab — without any extra scan;
 *   - fires `onChange` exactly once whenever the resolved active id changes.
 *
 * Keeping this beside `useDragReorder` makes the coordinator (`TabBar.tsx`) a
 * thin composition of two focused hooks plus a single render pass.
 */

export interface UseActiveTabOptions {
    /** Controlled active id. When provided, internal state is not used. */
    controlledId?: string;
    /** Initial active id for the uncontrolled case. */
    defaultId?: string;
    /** Called once whenever the resolved active id changes. */
    onChange?: (id: string | null) => void;
}

export interface UseActiveTabResult {
    /** The currently resolved active id (controlled value or internal state). */
    activeId: string | null;
    /** Activate a tab by id (no-op in controlled mode). */
    select: (id: string) => void;
    /**
     * Reconcile the active tab against the tabs present this render. Call after
     * the render pass with whether the active tab still exists and what the
     * first tab is; if the active tab vanished, it adopts `firstId`.
     */
    reconcile: (activeExists: boolean, firstId: string | null) => void;
}

export function useActiveTab(
    options: UseActiveTabOptions = {},
): UseActiveTabResult {
    const { controlledId, defaultId, onChange } = options;
    const isControlled = controlledId !== undefined;

    const [internalId, setInternalId] = useState<string | null>(
        defaultId ?? null,
    );
    const activeId = isControlled ? controlledId : internalId;

    const select = useCallback(
        (id: string) => {
            if (!isControlled) setInternalId(id);
        },
        [isControlled],
    );

    // Deferred so callers can invoke it during their render pass; the actual
    // state update is scheduled in an effect to avoid setState-during-render.
    const pending = useRef<{ activeExists: boolean; firstId: string | null }>({
        activeExists: true,
        firstId: null,
    });
    const reconcile = useCallback(
        (activeExists: boolean, firstId: string | null) => {
            pending.current = { activeExists, firstId };
        },
        [],
    );

    useEffect(() => {
        if (isControlled) return;
        if (!pending.current.activeExists) {
            setInternalId(pending.current.firstId);
        }
    });

    // Notify on genuine changes only.
    const prev = useRef<string | null>(activeId ?? null);
    useEffect(() => {
        if (prev.current !== activeId) {
            prev.current = activeId ?? null;
            onChange?.(activeId ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    return { activeId, select, reconcile };
}
