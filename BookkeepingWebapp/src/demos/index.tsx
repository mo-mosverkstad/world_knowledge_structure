import React, { useEffect } from "react";

import { ReactCounterDemo } from "./ReactCounterDemo.tsx"
import { ReactTimerDemo } from "./ReactTimerDemo.tsx"
import { DataDrivenTabBarDemo } from "./DataDrivenTabBarDemo.tsx";
import { HierarchicalLedgerDemo } from "./HierarchicalLedgerDemo";
import { DataDrivenSpreadsheetDemo } from "./LedgerSpreadsheetDemo";

import { MathSyntaxDemo } from "./MathSyntaxDemo.tsx"

export function Demos() {
    // useEffect(() => MathSyntaxDemo(), []);
    return (
        <>
            <ReactCounterDemo />
            <ReactTimerDemo />
            <DataDrivenTabBarDemo />
            <DataDrivenSpreadsheetDemo />
            {/* Hierarchy as a CUSTOMISATION: same flat grid, tree in the
                caller. See HierarchicalLedgerDemo.tsx. */}
            <HierarchicalLedgerDemo />
        </>
    );
}
void React, useEffect, MathSyntaxDemo;