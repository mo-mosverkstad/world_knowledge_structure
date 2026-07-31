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
 * `null` IS A DESTINATION, NOT A GAP
 * ----------------------------------
 * `activeId === null` means "nothing is active", and that is a state the hook
 * must be able to *rest* in — a controlled host may hold it indefinitely. So the
 * vanished-tab check only ever fires for a NON-null id that is absent from the
 * traversal: an id naming a tab that is gone is broken, whereas `null` names no
 * tab by design and is already resolved.
 *
 * Seeding the very first active tab is therefore a separate concern from
 * recovering from a deleted one, even though both land on "the first tab".
 * Folding them together is what would make `null` unholdable, because every
 * render would read the resting `null` as a gap and propose the first tab again.
 * They are told apart by `hasSeeded`, and reported under different reasons
 * (`"initial"` vs `"fallback"`), which is what a host needs to tell "you have
 * not chosen yet" from "your choice was destroyed".
 *
 * ONE WRITER
 * ----------
 * Every path that wants to change the active tab — a user activation, the
 * initial seed and a vanished-tab fallback — funnels through the private
 * `requestChange(id, reason)`. It resolves ownership once: in uncontrolled mode
 * it writes internal state, in controlled mode it only asks the host via
 * `onSelect`. That symmetry is what makes controlled mode a first-class citizen
 * rather than a mode where half the behavior silently no-ops.
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
    /**
     * Initial active id for the uncontrolled case. Passing `null` explicitly
     * means "start with nothing active" and suppresses the `"initial"` seed;
     * omitting it lets the first tab be seeded.
     */
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
     * first tab is. Two distinct situations are resolved here:
     *
     *   - nothing has been active yet and no initial value was stated → `firstId`
     *     is requested as `"initial"`, once;
     *   - a NON-null active id is absent from the traversal → `firstId` is
     *     requested as a `"fallback"`, in controlled mode too, so the host is
     *     told its active id is dead instead of being left pointing at a missing
     *     tab.
     *
     * A resolved `null` is neither of those: it is a legitimate resting state and
     * is left alone.
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

    // Has an active tab ever been established? A controlled host states its own
    // initial value, and an explicit `defaultId` states it for the uncontrolled
    // case, so both count as already seeded. Only "uncontrolled and nothing
    // stated" needs the first tab proposed, and only once — otherwise a host
    // that deliberately holds `null` would be re-seeded on every render.
    const hasSeeded = useRef(isControlled || defaultId !== undefined);

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
            hasSeeded.current = true;
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
        const { activeExists, firstId } = pending.current;

        // SEED — nothing has ever been active and no initial value was stated.
        // Distinct from a fallback: there is no dead id to recover from.
        if (!hasSeeded.current) {
            if (firstId === null) return; // no tabs yet; seed when some arrive
            requestChange(firstId, "initial");
            return;
        }

        // A resolved `null` is a destination, not a gap. Nothing vanished, so
        // there is nothing to reconcile — this is what lets a controlled host
        // hold "nothing active" indefinitely.
        if (activeId === null) return;

        // FALLBACK — a non-null id naming a tab that is no longer yielded.
        if (activeExists) return;
        // Guard against re-requesting the same fallback every render, which a
        // controlled host that ignores the request would otherwise turn into a
        // render loop.
        if (firstId === activeId) return;
        requestChange(firstId, "fallback");
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
