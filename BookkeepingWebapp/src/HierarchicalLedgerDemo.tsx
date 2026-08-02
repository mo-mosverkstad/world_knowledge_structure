import { useState } from "react";
import {
    SpreadsheetView,
    type CellDescriptor,
} from "./views/spreadsheet-view-old";
import "./HierarchicalLedgerDemo.css";

/**
 * A HIERARCHICAL ledger, built on the flat `SpreadsheetView` with ZERO changes to
 * that component.
 *
 * This file exists to answer one question: how do you add hierarchy as a
 * *customisation* rather than as a grid feature? The answer is that the tree
 * lives entirely here, on the caller's side of the data port, and the grid never
 * learns it exists.
 *
 * THE THREE STEPS
 * ---------------
 *   1. Keep your data as a TREE. The grid never sees this shape.
 *   2. FLATTEN it to a list of visible rows. Only expanded nodes contribute.
 *   3. Hand the flat list to the grid. `getRowCount` returns its length, and
 *      `getCell(data, row, col)` indexes into it.
 *
 * Collapsing a node simply changes what `getRowCount` returns. That is the whole
 * mechanism. It works because the grid's contract is a pair of OPERATIONS
 * (`getRowCount`, `getCell`) rather than a data SHAPE like `rows: T[]` — so the
 * shape stays yours.
 *
 * THE ONE TRAP, AND HOW THIS AVOIDS IT
 * ------------------------------------
 * The grid seeds its editor with `String(descriptor.value)`. For a plain string
 * that is the value; for a React element it is the useless `"[object Object]"`.
 * So a cell must not be BOTH richly rendered AND editable.
 *
 * This demo sidesteps that by splitting the two jobs across two columns:
 *
 *   column 0   the twisty      rich markup, but `editable: false`
 *   column 1   the label       a plain string, indented via `className`
 *
 * Indentation is therefore a STYLE (`depth-2`), not markup wrapped around the
 * text — which is what lets the label stay a plain, editable string.
 *
 * If you would rather put the twisty inside the label cell, the grid needs one
 * new optional field, `editValue?: string`, so that what you display and what you
 * edit can differ. That is a small, backwards-compatible change; this file
 * deliberately does not require it.
 */

// ---------------------------------------------------------------------------
// 1. YOUR business data: a tree. The component never sees this type.
// ---------------------------------------------------------------------------

interface Account {
    label: string;
    /** Own amount. Parents here show the total of their subtree instead. */
    amount: number;
    children?: Account[];
}

const initialChart: Account[] = [
    {
        label: "Assets",
        amount: 0,
        children: [
            {
                label: "Cash",
                amount: 0,
                children: [
                    { label: "Checking", amount: 1200 },
                    { label: "Savings", amount: 8400 },
                ],
            },
            {
                label: "Receivables",
                amount: 0,
                children: [
                    { label: "Invoice 41", amount: 300 },
                    { label: "Invoice 42", amount: 950 },
                ],
            },
        ],
    },
    {
        label: "Liabilities",
        amount: 0,
        children: [
            { label: "Credit card", amount: -430 },
            { label: "Loan", amount: -12000 },
        ],
    },
    { label: "Opening balance", amount: 5000 },
];

/** A parent's amount is the sum of its subtree; a leaf's is its own. */
function subtotal(account: Account): number {
    if (!account.children?.length) return account.amount;
    return account.children.reduce((sum, child) => sum + subtotal(child), 0);
}

// ---------------------------------------------------------------------------
// 2. YOUR flattening: tree -> visible rows.
// ---------------------------------------------------------------------------

interface VisibleRow {
    account: Account;
    /** Nesting level, used for the indent class. */
    depth: number;
    /**
     * Stable address of this node in the tree, e.g. "/0/1". Used as the
     * expand/collapse key and to apply edits back to the right node.
     *
     * A PATH, not a row index: a row index shifts whenever something above it
     * expands or collapses, so it is not a stable way to name a node.
     */
    path: string;
    expandable: boolean;
    expanded: boolean;
    /**
     * This node's permanent position in the WHOLE tree, 1-based, counted in
     * document order over every node whether visible or not.
     *
     * Not the visible row index. The grid's default gutter label is `row + 1`,
     * which renumbers every surviving row whenever something collapses — so a
     * row appears to move when it did not. Measured before this fix:
     * "Liabilities" showed as row 8 expanded and row 2 collapsed.
     *
     * With a stable ordinal, collapsing HIDES numbers instead of reshuffling
     * them: 1, 2, 3, 4, 5, 8, 11 rather than 1, 2, 3, 4, 5, 6, 7.
     */
    ordinal: number;
}

/** Advance the counter past a hidden subtree without producing rows for it. */
function skipCounting(nodes: Account[], counter: { n: number }): void {
    nodes.forEach((account) => {
        counter.n++;
        if (account.children?.length) skipCounting(account.children, counter);
    });
}

function flatten(
    nodes: Account[],
    open: Set<string>,
    depth = 0,
    prefix = "",
    // Shared across the whole recursion, so numbering is continuous. An object
    // rather than a number because it has to be mutated by nested calls.
    counter: { n: number } = { n: 0 },
): VisibleRow[] {
    const out: VisibleRow[] = [];
    nodes.forEach((account, index) => {
        const path = `${prefix}/${index}`;
        const expandable = !!account.children?.length;
        const expanded = open.has(path);

        // Every node consumes a number, visible or not. That is what keeps the
        // numbering stable across expand and collapse.
        counter.n++;
        const ordinal = counter.n;

        out.push({ account, depth, path, expandable, expanded, ordinal });

        // The recursion IS the hierarchy. A collapsed node contributes one row;
        // an expanded one contributes itself plus its whole visible subtree.
        if (expandable && expanded) {
            out.push(
                ...flatten(
                    account.children!,
                    open,
                    depth + 1,
                    path,
                    counter,
                ),
            );
        } else if (expandable) {
            // COLLAPSED: the children produce no rows, but they still consume
            // numbers, so the next visible row keeps the number it would have
            // had. Without this branch the gutter renumbers on every collapse.
            skipCounting(account.children!, counter);
        }
    });
    return out;
}

/** Apply an edited label back into the tree, addressed by path. */
function renameAt(nodes: Account[], path: string, label: string): Account[] {
    // "/0/1" -> [0, 1]
    const [head, ...rest] = path
        .split("/")
        .filter(Boolean)
        .map((n) => Number(n));

    return nodes.map((account, index) => {
        if (index !== head) return account;
        if (rest.length === 0) return { ...account, label };
        return {
            ...account,
            children: renameAt(account.children ?? [], rest.join("/"), label),
        };
    });
}

/** Apply an edited amount back into the tree, addressed by path. */
function setAmountAt(
    nodes: Account[],
    path: string,
    amount: number,
): Account[] {
    const [head, ...rest] = path
        .split("/")
        .filter(Boolean)
        .map((n) => Number(n));

    return nodes.map((account, index) => {
        if (index !== head) return account;
        if (rest.length === 0) return { ...account, amount };
        return {
            ...account,
            children: setAmountAt(account.children ?? [], rest.join("/"), amount),
        };
    });
}

// ---------------------------------------------------------------------------
// 3. The shape handed to the grid: just a list of visible rows.
// ---------------------------------------------------------------------------

interface GridData {
    rows: VisibleRow[];
}

const COLUMNS = ["", "Account", "Amount"] as const;

export function HierarchicalLedgerDemo() {
    const [chart, setChart] = useState<Account[]>(initialChart);
    /** Which paths are expanded. The only state hierarchy needs. */
    const [open, setOpen] = useState<Set<string>>(
        () => new Set(["/0", "/0/0"]),
    );
    /**
     * The PATH being edited, captured when the edit began.
     *
     * `onCellEdit` reports a visible ROW INDEX, and a row index stops meaning
     * the same thing the moment rows move: collapse a node while editing and
     * row 2 now names a different account. Committing then renamed the wrong
     * one — measured: editing "Checking", collapsing all, committing, renamed
     * "Opening balance" instead. Silent corruption.
     *
     * The grid cannot prevent this (to it, row 2 is row 2), so identity is the
     * caller's job. This is the same lesson as the tab bar addressing tabs by
     * `id` rather than index.
     */
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const pushLog = (msg: string) =>
        setLog((prev) => [msg, ...prev].slice(0, 5));

    // Recomputed every render. This is the O(visible) flattening pass, and it is
    // the price of the approach: expanding or collapsing rebuilds the list. For a
    // large tree you would memoise it on [chart, open].
    const rows = flatten(chart, open);
    const data: GridData = { rows };

    // If the row being edited is no longer visible, close the editor rather than
    // leaving it floating over an unrelated row until the user commits. The
    // stale-path guard in `onCellEdit` prevents corruption either way; this is
    // about not showing a box that points at nothing.
    const editedStillVisible =
        editingPath === null || rows.some((r) => r.path === editingPath);

    const toggle = (path: string) => {
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
        pushLog(`toggle ${path}`);
    };

    const expandAll = () => {
        const all = new Set<string>();
        const walk = (nodes: Account[], prefix = "") =>
            nodes.forEach((account, i) => {
                const path = `${prefix}/${i}`;
                if (account.children?.length) {
                    all.add(path);
                    walk(account.children, path);
                }
            });
        walk(chart);
        setOpen(all);
        pushLog("expand all");
    };

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: 640, marginTop: 32 }}>
            <h3>Hierarchical ledger (same flat SpreadsheetView)</h3>

            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
                <button type="button" onClick={expandAll}>
                    expand all
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(new Set());
                        pushLog("collapse all");
                    }}
                >
                    collapse all
                </button>
            </div>

            <SpreadsheetView<GridData>
                data={data}
                // The grid asks how many VISIBLE rows there are. Collapsing a node
                // makes this number smaller; that is the entire mechanism.
                getRowCount={(d) => d.rows.length}
                getColumnCount={() => COLUMNS.length}
                getColumnHeader={(_, col) => COLUMNS[col]}
                // Number rows by IDENTITY, not by visible position, so
                // collapsing hides numbers instead of renumbering the rest.
                getRowHeader={(d, row) => d.rows[row].ordinal}
                getCell={(d, row, col): CellDescriptor => {
                    const visible = d.rows[row];
                    switch (col) {
                        case 0:
                            // THE TWISTY COLUMN. Rich markup is fine here because
                            // it is explicitly NOT editable, so the grid never
                            // tries to seed a text draft from it.
                            return {
                                editable: false,
                                value: visible.expandable ? (
                                    <button
                                        type="button"
                                        className="twisty"
                                        aria-label={
                                            visible.expanded
                                                ? "Collapse"
                                                : "Expand"
                                        }
                                        onClick={(e) => {
                                            // Otherwise the click also selects
                                            // the cell underneath it.
                                            e.stopPropagation();
                                            toggle(visible.path);
                                        }}
                                    >
                                        {visible.expanded ? "\u2212" : "+"}
                                    </button>
                                ) : null,
                            };

                        case 1:
                            // THE LABEL COLUMN. A PLAIN STRING, so the editor
                            // seeds correctly. Depth is a CLASS, not markup —
                            // that is what keeps the value a string.
                            return {
                                value: visible.account.label,
                                className: `depth-${Math.min(visible.depth, 4)}`,
                            };

                        default: {
                            // Parents show a subtotal and are read-only, because
                            // editing a computed value is meaningless.
                            const isParent = visible.expandable;
                            return {
                                value: subtotal(visible.account).toFixed(2),
                                align: "right",
                                editable: !isParent,
                                className: isParent ? "subtotal" : undefined,
                            };
                        }
                    }
                }}
                editable
                // Capture the row IDENTITY while it is still unambiguous.
                onEditBegin={(row, _col, d) => setEditingPath(d.rows[row].path)}
                onCellEdit={(row, col, value, d) => {
                    // Edits arrive addressed by VISIBLE row, which is not a
                    // stable address into the tree — so translate it to a path
                    // before applying. This is the one place the two addressing
                    // schemes meet.
                    const path = d.rows[row].path;

                    // If the row now names a different node than when the edit
                    // began, the address is stale: discard rather than write to
                    // whatever happens to sit at that index now.
                    if (editingPath !== null && editingPath !== path) {
                        pushLog(`discarded stale edit (${editingPath})`);
                        setEditingPath(null);
                        return;
                    }
                    setEditingPath(null);

                    if (col === 1) {
                        pushLog(`rename ${path} -> "${value}"`);
                        setChart((prev) => renameAt(prev, path, value));
                    } else if (col === 2) {
                        const amount = Number(value);
                        if (!Number.isNaN(amount)) {
                            pushLog(`amount ${path} -> ${amount}`);
                            setChart((prev) => setAmountAt(prev, path, amount));
                        }
                    }
                }}
                // Remounting the grid when the edited row disappears is the
                // bluntest way to drop a stale edit, and it is honest: the edit
                // has genuinely lost its subject. A dedicated "cancel edit" prop
                // would be gentler, and is the better fix if this becomes common.
                key={editedStillVisible ? "grid" : `grid-reset-${rows.length}`}
                maxWidth="100%"
                maxHeight="220px"
                defaultActiveCell={{ row: 0, col: 1 }}
            />

            <pre
                style={{
                    background: "#f5f5f5",
                    padding: 8,
                    fontSize: 12,
                    minHeight: 60,
                }}
            >
                {log.map((l) => `${l}\n`).join("") || "(interaction log)"}
            </pre>
            <p style={{ fontSize: 12, color: "#666" }}>
                The grid is the same flat component as the demo above: it has no
                notion of a tree. Click a twisty to expand or collapse; the row
                count changes and the grid simply renders whatever rows it is
                given. Double-click an Account or a leaf Amount to edit it.
                Parent amounts are subtotals and read-only.
            </p>
        </div>
    );
}
