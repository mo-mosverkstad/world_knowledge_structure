import React, { useEffect } from "react";

import { ReactCounterDemo } from "./ReactCounterDemo.tsx"
import { ReactTimerDemo } from "./ReactTimerDemo.tsx"
import { TabBarDemo } from "./TabBarDemo.tsx";
import { HierarchicalLedgerDemo } from "./HierarchicalLedgerDemo";
import { DataDrivenSpreadsheetDemo } from "./LedgerSpreadsheetDemo";
import { SpreadsheetViewDemo } from "./SpreadsheetViewDemo.tsx";
import { TableViewDemo } from "./TableViewDemo.tsx";

import { MathSyntaxDemo } from "./MathSyntaxDemo.tsx"

export function Demos() {
    // useEffect(() => MathSyntaxDemo(), []);
    return (
        <>
            <h1>Basic React demos</h1>
            <ReactCounterDemo />
            <ReactTimerDemo />
            <h1>Editor toolkit components</h1>
            <TabBarDemo />
            <TableViewDemo />
            <SpreadsheetViewDemo />
            <hr></hr>
            <h1>Old demos</h1>
            <DataDrivenSpreadsheetDemo />
            <HierarchicalLedgerDemo />
        </>
    );
}
void React, useEffect, MathSyntaxDemo;
