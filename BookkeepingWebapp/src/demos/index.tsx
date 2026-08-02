import React, { useEffect } from "react";

import { ReactCounterDemo } from "./ReactCounterDemo.tsx"
import { ReactTimerDemo } from "./ReactTimerDemo.tsx"
import { TabBarDemo } from "./TabBarDemo.tsx";
import { HierarchicalLedgerDemo } from "./HierarchicalLedgerDemo";
import { DataDrivenSpreadsheetDemo } from "./LedgerSpreadsheetDemo";
import { SpreadsheetViewDemo } from "./SpreadsheetViewDemo.tsx";

import { MathSyntaxDemo } from "./MathSyntaxDemo.tsx"

export function Demos() {
    // useEffect(() => MathSyntaxDemo(), []);
    return (
        <>
            <ReactCounterDemo />
            <ReactTimerDemo />
            <TabBarDemo />
            <h1>Old demos</h1>
            <DataDrivenSpreadsheetDemo />
            {/* Hierarchy as a CUSTOMISATION: same flat grid, tree in the
                caller. See HierarchicalLedgerDemo.tsx. */}
            <HierarchicalLedgerDemo />
            <h1>New demos</h1>
            <SpreadsheetViewDemo />
        </>
    );
}
void React, useEffect, MathSyntaxDemo;