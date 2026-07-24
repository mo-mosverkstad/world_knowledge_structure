import React from "react";
import ReactDOM from "react-dom/client";
import { useState } from "react";
import { AbstractParser } from "./parser/AbstractParser.ts";
import { mathSyntaxPlugin } from "./syntax-plugins/math";
import { TabBar, type TabDescriptor } from "./views/tab-bar/";

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

function DataDrivenTabBarDemo() {
    const [workspace, setWorkspace] = useState<WorkspaceState>({
        documents: [
            {
                key: "d1",
                label: "Home",
                kind: "report",
                dirty: false,
                locked: true,
            },
            { key: "d2", label: "January Ledger", kind: "ledger", dirty: true },
            { key: "d3", label: "Q1 Report", kind: "report", dirty: false },
            { key: "d4", label: "Settings", kind: "settings", dirty: false },
        ],
        activeKey: "d1",
    });
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

    // BEHAVIOR hook: mirror the active tab back into the business data.
    const handleActiveChange = (tabId: string | null) => {
        pushLog(`active -> ${tabId}`);
        setWorkspace((prev) => ({ ...prev, activeKey: tabId }));
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
                onActiveTabChange={handleActiveChange}
                closable
                reorderable
            />

            <div style={{ padding: "12px 4px" }}>
                <strong>Active document:</strong>{" "}
                {active ? `${active.label} (${active.kind})` : "none"}
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
                Try: click tabs, drag to reorder, press × to close. "Home" is
                pinned (not closable).
            </p>
        </div>
    );
}

function manual_test_2() {
    ReactDOM.createRoot(document.getElementById("root")!).render(
        <DataDrivenTabBarDemo />,
    );
}

manual_test_2();

// Keep unused references reachable to preserve prior manual demos.
void manual_test_1;
void AbstractParser;
void React;
