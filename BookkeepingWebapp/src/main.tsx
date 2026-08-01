import React from "react";
import ReactDOM from "react-dom/client";
import { useState } from "react";
import { AbstractParser } from "./parser/AbstractParser.ts";
import { mathSyntaxPlugin } from "./syntax-plugins/math";
import {
    TabBar,
    type TabDescriptor,
    type ActiveTabSelectReason,
} from "./views/tab-bar/";
import {
    SpreadsheetView,
    type CellDescriptor,
} from "./views/spreadsheet-view/";

function manual_test_1() {
    ReactDOM.createRoot(document.getElementById("app")!).render(
        <div>Tsx component</div>,
    );
    console.log(<div>Tsx component</div>);

    console.log("5x^3+6x+7", JSON.stringify(mathSyntaxPlugin.parse("5x^3+6x+7")));
    console.log(
        "2\\sin^2(5x+3)",
        JSON.stringify(mathSyntaxPlugin.parse("2\\sin^2(5x+3)")),
    );
    console.log(
        "2\\sin^2(5x+3)+\\cos(4x)",
        JSON.stringify(mathSyntaxPlugin.parse("2\\sin^2(5x+3)+\\cos(4x)")),
    );
    // console.log("2x+", JSON.stringify(mathSyntaxPlugin.parse("2x+")))
    // console.log("\\int{", JSON.stringify(mathSyntaxPlugin.parse("\\int{")))
    console.log(
        "3+5 hello",
        JSON.stringify(mathSyntaxPlugin.parse("3+5 hello")),
    ); // Must fail, but does not fail
    console.log("3+@", JSON.stringify(mathSyntaxPlugin.parse("3+@")));
    console.log("2++5", JSON.stringify(mathSyntaxPlugin.parse("2++5"))); // Must also fail, but doesn't
}

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

function DataDrivenTabBarDemo() {
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

function manual_test_2() {
    ReactDOM.createRoot(document.getElementById("root")!).render(
        <DataDrivenTabBarDemo />,
    );
}

/**
 * An ARBITRARY business data structure for the spreadsheet. Like the tab bar,
 * SpreadsheetView never sees this shape — it reaches in via getCell / counts /
 * onCellEdit only. Here it happens to be a simple ledger of transactions.
 */
interface Txn {
    date: string;
    description: string;
    amount: number;
}

interface LedgerState {
    columns: { label: string; align?: "left" | "right" }[];
    rows: Txn[];
}

function DataDrivenSpreadsheetDemo() {
    const [ledger, setLedger] = useState<LedgerState>({
        columns: [
            { label: "Date" },
            { label: "Description" },
            { label: "Amount", align: "right" },
        ],
        rows: [
            { date: "2026-01-03", description: "Opening balance", amount: 1000 },
            { date: "2026-01-05", description: "Groceries", amount: -84.2 },
            {
                date: "2026-01-09",
                description: "Salary\nmonthly, after tax",
                amount: 2500,
            },
            { date: "2026-01-12", description: "Electricity", amount: -120.5 },
        ],
    });
    const [log, setLog] = useState<string[]>([]);
    const pushLog = (msg: string) =>
        setLog((prev) => [msg, ...prev].slice(0, 6));

    // ACCESS callbacks: random access into the business data. A grid asks only
    // for the cells it needs (which pairs with future virtualization).
    const getRowCount = (data: LedgerState) => data.rows.length;
    const getColumnCount = (data: LedgerState) => data.columns.length;
    const getColumnHeader = (data: LedgerState, col: number) =>
        data.columns[col].label;

    const getCell = (
        data: LedgerState,
        row: number,
        col: number,
    ): CellDescriptor => {
        const txn = data.rows[row];
        switch (col) {
            case 0:
                return { value: txn.date };
            case 1:
                // Only the description wraps. The date and amount stay
                // single-line so a stray newline cannot reach Number().
                return { value: txn.description, multiline: true };
            case 2:
                return {
                    value: txn.amount.toFixed(2),
                    align: "right",
                };
            default:
                return { value: "" };
        }
    };

    // MUTATE callback: apply a committed edit to the business data structure.
    const handleCellEdit = (
        row: number,
        col: number,
        value: string,
        data: LedgerState,
    ) => {
        pushLog(`edit (${row},${col}) = "${value}"`);
        setLedger(() => {
            const rows = data.rows.map((r) => ({ ...r }));
            const txn = rows[row];
            if (col === 0) txn.date = value;
            else if (col === 1) txn.description = value;
            else if (col === 2) {
                const n = Number(value);
                if (!Number.isNaN(n)) txn.amount = n;
            }
            return { ...data, rows };
        });
    };

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640, marginTop: 32 }}>
            <h3>Data-driven SpreadsheetView demo</h3>
            <SpreadsheetView<LedgerState>
                data={ledger}
                getRowCount={getRowCount}
                getColumnCount={getColumnCount}
                getCell={getCell}
                getColumnHeader={getColumnHeader}
                onCellEdit={handleCellEdit}
                onCellClick={(r, c) => pushLog(`click (${r},${c})`)}
                onSelectionChange={(cell) =>
                    pushLog(`select ${cell ? `(${cell.row},${cell.col})` : "none"}`)
                }
                editable
                defaultActiveCell={{ row: 0, col: 0 }}
            />
            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 8,
                    fontSize: 12,
                    minHeight: 70,
                }}
            >
                {log.map((l) => `${l}\n`).join("") || "(interaction log)"}
            </pre>
            <p style={{ fontSize: 12, color: "#666" }}>
                Click a cell to select; arrow keys navigate; Enter/F2 or
                double-click edits; Enter commits, Esc cancels. The
                Description column is multiline: Alt+Enter inserts a line
                break at the caret.
            </p>
        </div>
    );
}

function Demos() {
    return (
        <>
            <DataDrivenTabBarDemo />
            <DataDrivenSpreadsheetDemo />
        </>
    );
}

function manual_test_3() {
    ReactDOM.createRoot(document.getElementById("root")!).render(<Demos />);
}

manual_test_3();

// Keep unused references reachable to preserve prior manual demos.
void manual_test_1;
void manual_test_2;
void AbstractParser;
void React;
