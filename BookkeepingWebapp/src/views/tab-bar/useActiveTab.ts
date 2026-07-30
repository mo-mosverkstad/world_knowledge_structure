import { useCallback, useEffect, useRef, useState } from "react";
import { type ActiveTabSelectReason } from "./types";

/**
 * INTERNAL helper — not part of the tab-bar public API.
 *
 * `useActiveTab` encapsulates the intrinsic "which tab is active" concern of a
 * tab bar, in both controlled and uncontrolled modes:
 *   - remembers the active tab id (uncontrolled) or defers to the caller
 *     (controlled, when `controlledId` is provided — including `null`);
 *   - exposes `select(id)` for the coordinator to call on a tab activation;
 *   - reconciles the active tab against the current set of tabs each render
 *     (via {@link UseActiveTabResult.reconcile}) so a closed/removed active tab
 *     falls back to the first available tab — without any extra scan;
 *   - fires `onSelect` for every *requested* change, in both modes, so a
 *     controlled host can act on it;
 *   - fires `onChange` exactly once whenever the resolved active id changes.
 *
 * ONE WRITER
 * ----------
 * Every path that wants to change the active tab — a user activation and a
 * vanished-tab fallback — funnels through the private `requestChange(id,
 * reason)`. It resolves ownership once: in uncontrolled mode it writes internal
 * state, in controlled mode it only asks the host via `onSelect`. That symmetry
 * is what makes controlled mode a first-class citizen rather than a mode where
 * half the behavior silently no-ops.
 *
 * Keeping this beside `useDragReorder` makes the coordinator (`TabBar.tsx`) a
 * thin composition of two focused hooks plus a single render pass.
 */

export interface UseActiveTabOptions {
    /**
     * Controlled active id. When this is not `undefined` the hook is in
     * controlled mode and never writes internal state; `null` is a legal
     * controlled value meaning "nothing active".
     */
    controlledId?: string | null;
    /** Initial active id for the uncontrolled case. */
    defaultId?: string | null;
    /**
     * Called for every requested change, before it is applied, in BOTH modes.
     * In controlled mode this is the only channel the hook has — if the host
     * does not act on it, the active tab does not change.
     */
    onSelect?: (id: string | null, reason: ActiveTabSelectReason) => void;
    /** Called once whenever the resolved active id changes. */
    onChange?: (id: string | null) => void;
}

export interface UseActiveTabResult {
    /** The currently resolved active id (controlled value or internal state). */
    activeId: string | null;
    /**
     * Request activation of a tab by id. Applies directly when uncontrolled;
     * asks the host via `onSelect` when controlled.
     */
    select: (id: string | null) => void;
    /**
     * Reconcile the active tab against the tabs present this render. Call after
     * the render pass with whether the active tab still exists and what the
     * first tab is; if the active tab vanished, `firstId` is requested as a
     * `"fallback"` — in controlled mode too, so the host is told its active id
     * is dead instead of being left pointing at a missing tab.
     */
    reconcile: (activeExists: boolean, firstId: string | null) => void;
}

export function useActiveTab(
    options: UseActiveTabOptions = {},
): UseActiveTabResult {
    const { controlledId, defaultId, onSelect, onChange } = options;
    const isControlled = controlledId !== undefined;

    const [internalId, setInternalId] = useState<string | null>(
        defaultId ?? null,
    );
    const activeId = isControlled ? controlledId : internalId;

    // Callbacks are read through refs so that `requestChange` — and therefore
    // `select`, which the coordinator hands to every <Tab> — stays referentially
    // stable even when the caller passes fresh inline closures each render.
    const onSelectRef = useRef(onSelect);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onSelectRef.current = onSelect;
        onChangeRef.current = onChange;
    });

    // ---- THE SINGLE WRITER -------------------------------------------------
    const requestChange = useCallback(
        (id: string | null, reason: ActiveTabSelectReason) => {
            onSelectRef.current?.(id, reason);
            // Controlled: the host owns the value; it must apply the change by
            // feeding a new `controlledId` back in. Uncontrolled: apply here.
            if (!isControlled) setInternalId(id);
        },
        [isControlled],
    );

    const select = useCallback(
        (id: string | null) => requestChange(id, "user-select"),
        [requestChange],
    );

    // Deferred so callers can invoke it during their render pass; the actual
    // request is issued in an effect, because neither a setState nor a parent's
    // setter may be called while rendering.
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
        if (pending.current.activeExists) return;
        const replacement = pending.current.firstId;
        // Guard against re-requesting the same fallback every render, which a
        // controlled host that ignores the request would otherwise turn into a
        // render loop.
        if (replacement === activeId) return;
        requestChange(replacement, "fallback");
    });

    // Notify on genuine changes only.
    const prev = useRef<string | null>(activeId ?? null);
    useEffect(() => {
        if (prev.current !== activeId) {
            prev.current = activeId ?? null;
            onChangeRef.current?.(activeId ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    return { activeId, select, reconcile };
}
