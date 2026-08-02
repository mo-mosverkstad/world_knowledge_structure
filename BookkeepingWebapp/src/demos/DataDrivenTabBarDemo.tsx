import React, { useState } from "react";
import {
    TabBar,
    type TabDescriptor,
    type ActiveTabSelectReason,
} from "../views/tab-bar/";

/**
 * An ARBITRARY business data structure. The tab bar knows nothing about this
 * shape — it only receives it through the `data` port and reaches into it via
 * the fetch/mutate callbacks we provide below.
 *
 * Here a "document" happens to carry a kind, a label and a dirty flag. It could
 * just as easily be an account, a ledger page, or anything else.
 */
interface WorkspaceDoc {
    key: string;
    label: string;
    kind: "ledger" | "report" | "settings";
    dirty: boolean;
    locked?: boolean;
}

interface WorkspaceState {
    documents: WorkspaceDoc[];
    activeKey: string | null;
}

const DOC_KINDS = ["ledger", "report", "settings"] as const;

/** Word pool for randomly generated document labels. */
const LABEL_WORDS = [
    "January", "February", "March", "Q1", "Q2", "Annual", "Draft", "Audit",
    "Payroll", "Invoices", "Receipts", "Assets", "Vendors", "Taxes", "Budget",
    "Forecast", "Notes",
];

const pick = <T,>(xs: readonly T[]): T =>
    xs[Math.floor(Math.random() * xs.length)];

/** Monotonic id source, so keys stay unique across adds and closes. */
let nextDocId = 100;

function randomDoc(): WorkspaceDoc {
    return {
        key: `d${nextDocId++}`,
        label: `${pick(LABEL_WORDS)} ${pick(LABEL_WORDS)}`,
        kind: pick(DOC_KINDS),
        dirty: Math.random() < 0.3,
    };
}

/**
 * Enough tabs to overflow a normal display, so both the scrolling and the
 * reveal-on-activate behavior are visible immediately. At 149px per tab, 17
 * tabs need roughly 2.5k px of strip.
 */
function initialDocuments(): WorkspaceDoc[] {
    const home: WorkspaceDoc = {
        key: "d1",
        label: "Home",
        kind: "report",
        dirty: false,
        locked: true, // pinned open: per-tab `closable: false`
    };
    return [home, ...Array.from({ length: 16 }, randomDoc)];
}

export function DataDrivenTabBarDemo() {
    const [workspace, setWorkspace] = useState<WorkspaceState>(() => ({
        documents: initialDocuments(),
        activeKey: "d1",
    }));
    const [log, setLog] = useState<string[]>([]);

    const pushLog = (msg: string) =>
        setLog((prev) => [msg, ...prev].slice(0, 8));

    // ITERATOR callback: traverse the business data exactly once, yielding each
    // tab into the visitor the component supplies. Here the structure is an
    // array, but the same contract works for a linked list or tree walk without
    // ever paying for random (indexed) access.
    const forEachTab = (
        data: WorkspaceState,
        visit: (tab: TabDescriptor, index: number) => void,
    ) => {
        data.documents.forEach((doc, index) =>
            visit(
                {
                    id: doc.key,
                    title: doc.dirty ? `${doc.label} •` : doc.label,
                    // "Home" is locked -> pinned open, per-tab override.
                    closable: !doc.locked,
                },
                index,
            ),
        );
    };

    // MUTATE callback: remove a document from the business data structure.
    const handleClose = (tabId: string, data: WorkspaceState) => {
        pushLog(`close ${tabId}`);
        setWorkspace(() => ({
            ...data,
            documents: data.documents.filter((d) => d.key !== tabId),
        }));
    };

    // MUTATE callback: reorder the documents in the business data structure.
    const handleReorder = (
        from: number,
        to: number,
        data: WorkspaceState,
    ) => {
        pushLog(`reorder ${from} -> ${to}`);
        setWorkspace(() => {
            const docs = [...data.documents];
            const [moved] = docs.splice(from, 1);
            docs.splice(to, 0, moved);
            return { ...data, documents: docs };
        });
    };

    // BEHAVIOR hook: what "clicking a tab" means is defined here, by the caller.
    const handleClick = (tabId: string) => {
        pushLog(`click ${tabId}`);
    };

    // ACTIVE-TAB PORT, write half: the component REQUESTS a new active tab and
    // this host applies it into its own state. Because `activeKey` now lives in
    // the host's data structure (rather than being mirrored out of the
    // component), anything else in the app can change it too — see the buttons
    // below. `reason` distinguishes a deliberate user click from the component
    // reporting that the active tab no longer exists.
    const handleActiveSelect = (
        tabId: string | null,
        _data: WorkspaceState,
        reason: ActiveTabSelectReason,
    ) => {
        pushLog(`select ${tabId} (${reason})`);
        setWorkspace((prev) => ({ ...prev, activeKey: tabId }));
    };

    // NOTIFICATION only: the active tab has settled on this id/index.
    const handleActiveChange = (tabId: string | null, index: number | null) => {
        pushLog(`active -> ${tabId} @${index}`);
    };

    // EXTERNAL MODIFICATION: nothing here goes through the component. The host
    // owns `activeKey`, so it just writes it and the tab bar follows.
    const stepActive = (delta: number) => {
        setWorkspace((prev) => {
            if (prev.documents.length === 0) return prev;
            const current = prev.documents.findIndex(
                (d) => d.key === prev.activeKey,
            );
            const next =
                (current + delta + prev.documents.length) %
                prev.documents.length;
            return { ...prev, activeKey: prev.documents[next].key };
        });
    };

    // ADD a randomly generated document. `activate` demonstrates the reveal
    // behavior: the new tab is appended at the far end, well outside the
    // viewport, and simply setting `activeKey` scrolls it into view. Note that
    // nothing here mentions scrolling — the tab bar observes the active-tab
    // change and reveals it on its own.
    const addRandomDoc = (activate: boolean) => {
        const doc = randomDoc();
        pushLog(`add ${doc.key} (${doc.label})${activate ? " + activate" : ""}`);
        setWorkspace((prev) => ({
            documents: [...prev.documents, doc],
            activeKey: activate ? doc.key : prev.activeKey,
        }));
    };

    // ADD several at once, to overflow the strip again after closing many.
    const addManyDocs = (count: number) => {
        pushLog(`add ${count} docs`);
        setWorkspace((prev) => ({
            ...prev,
            documents: [
                ...prev.documents,
                ...Array.from({ length: count }, randomDoc),
            ],
        }));
    };

    // INSERT AFTER THE ACTIVE TAB — the interesting case for identity.
    //
    // The host holds `activeKey` as an ID, so a position has to be looked up to
    // splice at. Note where that lookup lives: inside the updater, used once,
    // and thrown away. No index is ever stored, which is why the active tab
    // needs no fix-up afterwards even though the insert shifts every position
    // after it.
    //
    // Compare with the spreadsheet, whose selection IS a {row, col}: there the
    // same insert silently moves the selection onto a different record unless
    // the host recomputes it.
    const insertAfterActive = (activate: boolean) => {
        const doc = randomDoc();
        pushLog(`insert ${doc.key} after ${workspace.activeKey ?? "start"}`);
        setWorkspace((prev) => {
            const at = prev.documents.findIndex(
                (d) => d.key === prev.activeKey,
            );
            const documents = [...prev.documents];
            // `at` is -1 when nothing is active, making this a splice(0, 0, ...)
            // prepend — the sensible reading of "after nothing".
            documents.splice(at + 1, 0, doc);
            return {
                documents,
                // Leaving `activeKey` untouched is the whole demonstration: the
                // id still names the same document, so the highlight does not
                // move even though that document is now one position later.
                activeKey: activate ? doc.key : prev.activeKey,
            };
        });
    };

    const active = workspace.documents.find(
        (d) => d.key === workspace.activeKey,
    );

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640 }}>
            <h3>Data-driven TabBar demo</h3>
            <TabBar<WorkspaceState>
                data={workspace}
                forEachTab={forEachTab}
                onTabClick={handleClick}
                onTabClose={handleClose}
                onTabReorder={handleReorder}
                // ---- ACTIVE-TAB PORT: read half + write half ----
                activeTabId={workspace.activeKey}
                onActiveTabSelect={handleActiveSelect}
                onActiveTabChange={handleActiveChange}
                // ---- SIZING: bound the strip so 17 tabs overflow ----
                maxWidth="100%"
                closable
                reorderable
            />

            <div style={{ padding: "12px 4px" }}>
                <strong>Active document:</strong>{" "}
                {active ? `${active.label} (${active.kind})` : "none"}
            </div>

            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
                <button type="button" onClick={() => stepActive(-1)}>
                    ◀ previous
                </button>
                <button type="button" onClick={() => stepActive(1)}>
                    next ▶
                </button>
                <button
                    type="button"
                    onClick={() =>
                        setWorkspace((prev) => ({ ...prev, activeKey: null }))
                    }
                >
                    clear selection
                </button>
            </div>

            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
                <button type="button" onClick={() => addRandomDoc(true)}>
                    + add &amp; activate
                </button>
                <button type="button" onClick={() => addRandomDoc(false)}>
                    + add (stay put)
                </button>
                <button type="button" onClick={() => addManyDocs(5)}>

                    + add 5

                </button>
                <button
                    type="button"
                    onClick={() => insertAfterActive(false)}
                >
                    insert after active
                </button>
                <button type="button" onClick={() => insertAfterActive(true)}>
                    insert after &amp; activate
                </button>
                <button
                    type="button"
                    onClick={() => {
                        pushLog("reset");
                        setWorkspace({
                            documents: initialDocuments(),
                            activeKey: "d1",
                        });
                    }}
                >
                    reset
                </button>
            </div>

            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 8,
                    fontSize: 12,
                    minHeight: 80,
                }}
            >
                {log.map((l) => `${l}\n`).join("") || "(interaction log)"}
            </pre>
            <p style={{ fontSize: 12, color: "#666" }}>
                Try: click tabs, drag to reorder, press × to close, and add
                new ones. "Home" is pinned (not closable); every generated tab
                is closable. The strip scrolls when it overflows — the
                scrollbar appears while you hover or keyboard-focus it. "add
                &amp; activate" and "previous / next" both scroll the active tab
                into view without asking the component to.
            </p>
        </div>
    );
}
void React;