# Codebase Analysis

This document defines the architecture, domain model, design principles, and phased implementation plan for the Bookkeeping knowledge editor.

---

# Phase 0 — Environment Setup and Architecture Definition

## Domain Model

The application models a knowledge base rather than a collection of independent documents. A cheat sheet is a projection of an underlying semantic model — it does not own the knowledge it displays.

```
KnowledgeBase
+-- Inbox
+-- Collections
|   +-- Chemistry
|   +-- Mathematics
|   └-- Programming
+-- CheatSheets
|   +-- Exam A
|   +-- Exam B
|   └-- Pocket Reference
└-- Search Index
```

### Collations

Knowledge is organized into collations. A collation defines the grouping schema for a body of related knowledge — it determines how entries are categorized and what table structure they occupy. Examples include chemical classifications, collections of physical constants, mathematical theorems, problem-solving patterns, and programming concepts.

The primary design principle is that all knowledge sharing the same collation belongs to a single canonical hierarchical structure. Instead of creating multiple independent tables that recursively contain one another, all information with the same collation is accumulated into one hierarchy. As new knowledge is introduced, it is inserted into the existing hierarchy by refining or extending it rather than by creating another table with the same semantic purpose.

For example, instead of modeling

```
Chemical substances
+-- Organic chemistry
|   └-- Alkanes
+-- Biochemistry
|   └-- ...
|   └-- Biochemical pathways
```

as separate nested tables, the entire chemical classification is represented as one hierarchical table (or another suitable hierarchical structure). Likewise, mathematical theorems, formulas, proof techniques, and problem-solving patterns that belong to the same collation are accumulated into a single hierarchical representation rather than fragmented across many independent tables.

```
Chemical substances
+-- Organic compounds
|   +-- Hydrocarbons
|   |   +-- Alkanes
|   |   +-- Alkenes
|   |   └-- Alkynes
|   +-- Alcohols
|   +-- Aldehydes
|   └-- ...
+-- Inorganic compounds
+-- Organometallic compounds
└-- Biochemical compounds
    +-- Amino acids
    +-- Carbohydrates
    +-- Lipids
    └-- Proteins

Chemical reactions
+-- Reaction types
|   +-- Synthesis
|   +-- Decomposition
|   +-- Substitution
|   └-- Redox
+-- Organic reaction pathways
|   +-- Addition
|   +-- Elimination
|   +-- SN1
|   └-- SN2
+-- Inorganic reactions
└-- Biochemical pathways
    +-- Glycolysis
    +-- Citric acid cycle
    └-- Oxidative phosphorylation

Mathematics / Physics / Chemistry
+-- Mathematics
|   +-- Algebra
|   +-- Calculus
|   +-- Linear algebra
|   └-- Probability
+-- Physics
|   +-- Mechanics
|   +-- Electromagnetism
|   +-- Thermodynamics
|   └-- Quantum mechanics
└-- Chemistry
    +-- Stoichiometry
    +-- Thermochemistry
    +-- Chemical equilibrium
    └-- Kinetics
```

The hierarchy is organized according to semantic collation rather than document structure or field layout. Parent-child relationships express progressively finer semantic refinement of the same knowledge collection instead of arbitrary document containment.

Although hierarchical tables are expected to be the primary representation, some collations may be more naturally represented as diagrams or other hierarchical structures. The chosen representation does not change the semantic model; it is merely an alternative visualization of the same canonical hierarchy.

To support efficient lookup, knowledge items are additionally indexed through a hash-based search index. The index is independent of the hierarchical organization and exists solely to provide fast access to knowledge regardless of its position within the hierarchy.

This approach favors semantic aggregation over document fragmentation, ensuring that each collation has a single authoritative hierarchical representation that continuously evolves as the knowledge base grows.

### Inbox (Scratchpad)

The inbox serves as an unstructured capture area separate from the permanent knowledge hierarchy. It distinguishes **capture** from **organization**: the inbox is optimized for quickly recording ideas, while the organized hierarchies are optimized for retrieval and long-term maintenance.

The workflow is:

```text
Scratchpad
    ↓
Organize
    ↓
Layout hierarchy
    ↓
Published cheat sheet
```

The scratchpad is intentionally unstructured. Whether something belongs in a particular layout or hierarchy is not immediately decided.

For example:

```text
Scratchpad
+-- "Remember the Gaussian elimination shortcut."
+-- "Interesting periodic table mnemonic."
+-- Sketch of a graph.
+-- Formula from today's lecture.
└-- Random observation.
```

Later, during organization, each item is either:

* assigned to an existing layout hierarchy,
* merged into an existing table,
* turned into a new hierarchy, or
* discarded.

The scratchpad is not modeled as a subtype of `TableNode`. Instead it is a separate aggregate because its semantics are different — a scratchpad item has **no assigned layout, no permanent location, and no semantic commitment** until it is placed.

```text
KnowledgeBase
+-- Inbox
+-- Collections
└-- Index
```

---

## Architecture

### Directory Structure

```
Bookkeeping/
|
+-- lib/
|   |
|   +-- peg-parser/
|   |   |
|   |   +-- AbstractParser.ts
|   |   +-- types.d.ts
|   |
|   +-- history/
|   |   |
|   |   +-- History.ts
|   |
|   +-- btree/
|   |   |
|   |   +-- BPlusTree.ts
|   |
|   +-- event-bus/
|       |
|       +-- EventBus.ts
|
|
+-- src/
|   |
|   +-- domain/
|   |   |
|   |   +-- document/
|   |   |   |
|   |   |   +-- Document.ts
|   |   |   +-- DocumentSettings.ts
|   |   |
|   |   +-- treetable/
|   |   |   |
|   |   |   +-- TreeTable.ts
|   |   |   +-- TreeRow.ts
|   |   |   +-- TreeCell.ts
|   |   |   +-- CellReference.ts
|   |   |
|   |   +-- diagrams/
|   |   |   |
|   |   |   +-- Diagram.ts
|   |   |   +-- Node.ts
|   |   |   +-- Edge.ts
|   |   |   +-- Coordinate.ts
|   |   |
|   |   +-- bookkeeping/
|   |       |
|   |       +-- Account.ts
|   |       +-- Transaction.ts
|   |       +-- Journal.ts
|   |
|   |
|   +-- syntax/
|   |   |
|   |   +-- expressions/
|   |   |   |
|   |   |   +-- Expression.ts
|   |   |   +-- Formula.ts
|   |   |
|   |   +-- definitions/
|   |   |   |
|   |   |   +-- TokenTypes.ts
|   |   |   +-- Grammar.ts
|   |   |
|   |   +-- ast/
|   |   |   |
|   |   |   +-- AstNode.ts
|   |   |   +-- BinaryOperator.ts
|   |   |   +-- FunctionCall.ts
|   |   |
|   |   +-- parser/
|   |   |   |
|   |   |   +-- Lexer.ts
|   |   |   +-- Parser.ts
|   |   |
|   |   +-- compiler/
|   |   |   |
|   |   |   +-- SyntaxCompiler.ts
|   |   |   +-- GrammarIR.ts
|   |   |   +-- PackageSerializer.ts
|   |   |
|   |   +-- rendering/
|   |       |
|   |       +-- ExpressionRenderer.ts
|   |       +-- MathRenderer.ts
|   |
|   |
|   +-- presenters/
|   |   |
|   |   +-- app/ <- Bootstrap
|   |   |   |
|   |   |   +-- DocumentPresenter.ts
|   |   |   +-- NavigationPresenter.ts
|   |   |   +-- MainWindowPresenter.ts
|   |   |
|   |   +-- components/
|   |       |
|   |       +-- TreeTablePresenter.ts
|   |       +-- DiagramPresenter.ts
|   |       +-- GroupPresenter.ts
|   |       +-- BoxPresenter.ts
|   |       +-- ToolbarPresenter.ts
|   |       +-- SearchPresenter.ts
|   |       +-- DslEditorPresenter.ts (Not decided yet)
|   |
|   |
|   +-- views/
|   |   |
|   |   +-- app/
|   |   |   |
|   |   |   +-- MainWindow.tsx
|   |   |   +-- NavigationBar.tsx
|   |   |
|   |   +-- top-bar/
|   |   |   |
|   |   |   +-- TopBar.tsx
|   |   |   +-- TopBar.css
|   |   |   +-- TopBarElement.tsx
|   |   |   +-- TopBarElement.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- tool-bar/
|   |   |   |
|   |   |   +-- ToolBar.tsx
|   |   |   +-- ToolBar.css
|   |   |   +-- ToolBarElement.tsx
|   |   |   +-- ToolBarElement.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- tab-bar/
|   |   |   |
|   |   |   +-- TabBar.tsx
|   |   |   +-- TabBar.css
|   |   |   +-- TabBarElement.tsx
|   |   |   +-- TabBarElement.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- property-grid/
|   |   |   |
|   |   |   +-- PropertyGrid.tsx
|   |   |   +-- PropertyGrid.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- search-bar/
|   |   |   |
|   |   |   +-- SearchBar.tsx
|   |   |   +-- SearchBar.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- table-view/
|   |   |   |
|   |   |   +-- TableView.tsx
|   |   |   +-- TableView.css
|   |   |   +-- TableViewRowPrefix.tsx <- For tree table identation
|   |   |   +-- TableViewRowPrefix.css
|   |   |   +-- TableViewRow.tsx
|   |   |   +-- TableViewRow.css
|   |   |   +-- TableViewHeaderCell.tsx
|   |   |   +-- TableViewHeaderCell.css
|   |   |   +-- TableViewCell.tsx
|   |   |   +-- TableViewCell.css
|   |   |   +-- ... More if needed
|   |   |
|   |   +-- diagram-view/
|   |   |   |
|   |   |   +-- DiagramView.tsx
|   |   |   +-- DiagramView.css
|   |   |   +-- DiagramViewCell.tsx
|   |   |   +-- DiagramViewCell.css
|   |   |   +-- ... (Not decided yet)
|   |   |
|   |   +-- dsl-editor-view/
|   |   |   |
|   |   |   +-- ... (Not decided yet)
|   |   |
|   |   +-- card/ <- Atomic component inside cell
|   |   |   |
|   |   |   +-- Card.tsx
|   |   |   +-- Card.css
|   |   |
|   |   +-- native-math/
|   |   |   |
|   |   |   +-- NativeMath.tsx
|   |   |   +-- NativeMath.css
|   |   |   +-- ... (Not decided yet)
|   |   |
|   |   +-- native-arc/ <- Support geometry diagrams and etc.
|   |   |   |
|   |   |   +-- NativeArc.tsx
|   |   |   +-- NativeArc.css
|   |   |   +-- ... (Not decided yet)
|   |   |
|   |   +-- native-chemistry/
|   |   |   |
|   |   |   +-- NativeChemistry.tsx
|   |   |   +-- NativeChemistry.css
|   |   |   +-- ... (Not decided yet)
|   |   |
|   |   +-- other/ <- if needed, placeholder
|   |       |
|   |       +-- other.tsx
|   |       +-- other.css
|   |
|   |
|   +-- persistence/
|   |   |
|   |   +-- DocumentStorage.ts
|   |   +-- SyntaxPackageStorage.ts
|   |   +-- IndexedDBAdapter.ts
|   |   +-- FirebaseAdapter.ts
|   |   +-- ImportExport.ts
|   |
|   |
|   +-- statemanager/
|   |   |
|   |   +-- Command.ts
|   |   +-- UndoManager.ts
|   |   +-- SelectionState.ts
|   |   +-- ClipboardState.ts
|   |   +-- LayoutState.ts
|   |
|   |
|   +-- main.tsx
|
+-- package.json
```

### Intraproject Dependencies (`lib/`)

Certain components are generic infrastructure — they have no knowledge of the application domain and could be reused in any project. These are placed in `lib/` at the project root rather than being scattered inside `src/` alongside application-specific code.

The reason for separating them is to prevent accidental coupling. If a generic PEG parser engine lives inside `src/syntax/`, it sits next to domain-specific grammar definitions, and over time the boundary erodes: someone adds a convenience import, a shared type that references domain concepts, or a helper that assumes the math AST shape. The generic component silently becomes application-specific, and extracting it later requires untangling dependencies that would not have formed had the boundary been enforced from the start.

By placing these components under `lib/`, the separation is enforced at the filesystem level:

- `lib/` modules have **zero imports from `src/`**.
- `lib/` modules are **domain-ignorant** — they do not know about TreeTables, math syntax, bookkeeping, or any application concept.
- Each `lib/` subfolder is a **self-contained, independently extractable unit**.
- `src/` imports from `lib/`, never the reverse.

If a future project needs the same PEG parser or undo history, the extraction is trivial: move the folder out. The dependency boundary is already clean.

Components that belong in `lib/`:

| Module | Purpose |
|---|---|
| `peg-parser/` | Generic PEG parsing engine. Accepts any grammar definition, produces parse results. Does not know what is being parsed. |
| `history/` | Generic undo/redo command stack. Records and replays actions. Does not know what the actions do. |
| `btree/` | Generic B+ tree data structure. Provides ordered storage and range queries. Does not know what is being stored. |
| `event-bus/` | Generic publish/subscribe notification mechanism. Dispatches events. Does not know what the events mean. |

Components that remain in `src/`:

- Math syntax grammar rules (they define *what* to parse using the PEG engine — domain-specific)
- The syntax compiler in `syntax/compiler/` (bound to the app's meta-syntax, package format, and runtime interpreter — it *uses* the generic PEG engine but is application-specific orchestration, not a reusable library)
- `UndoManager` in `statemanager/` (wires the generic history to application-specific commands)
- All domain models, presenters, views, and persistence adapters

A TypeScript path alias keeps imports readable:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./lib/*"]
    }
  }
}
```

This makes the architectural boundary visible at every call site: `import { AbstractParser } from "@lib/peg-parser/AbstractParser"` immediately communicates that the dependency is on generic infrastructure rather than a sibling application module.

### Architectural Decisions

**Decision:** Expressions belong under `syntax/` rather than `domain/`, because expressions involve parsing, AST construction, grammar definitions, and rendering — forming a subsystem rather than pure data. Domain concepts (TreeTables, Diagrams, Bookkeeping) remain under `domain/`.

**Decision:** Generic, domain-ignorant infrastructure (PEG parser, undo history, data structures, event bus) belongs in `lib/` rather than being woven into the application layer folders where it would risk coupling to domain-specific code.

### Layer Summary

```text
src/

+-- domain/
+-- syntax/
+-- statemanager/
+-- presenters/
+-- views/
+-- persistence/
```

### Layer Responsibilities

#### Domain

Persistent document data. Everything in this layer is serializable.

```text
Document
+-- TreeTables
+-- Diagrams
+-- Bookkeeping
```

Examples of data that belongs here:

```text
Tree row hierarchy
Cell contents
Formula source text
Diagram nodes and edges
Account transactions
```

#### State Manager

Editor runtime state that is not part of the document itself.

```text
Selection
Clipboard
Undo Stack
Layout
```

For example:

```text
Document:
    TreeTable A exists

State:
    Row 42 is selected
```

Selection is not serialized into the document unless explicitly desired.

An event notification mechanism (EventBus, Observable, or Notifier) is needed to propagate changes across subsystems:

```text
TreeTable changed
Diagram changed
Selection changed
Undo stack changed
```

#### Syntax

A completely separate subsystem — essentially a mini compiler pipeline.

```text
Syntax Source
      |
      v
Lexer
      |
      v
Parser
      |
      v
AST
      |
      v
Renderer
```

#### Presenters

The Presenters and Views layers are the **only** layers permitted to contain HTML rendering and GUI-specific code. Every layer below them (domain, syntax, state manager, persistence, and everything in `lib/`) must remain free of presentation concerns so it stays portable and testable without a DOM.

Presenters split into two categories:

**App Presenters** — application-specific, aware of the document, persistence, navigation, and search:

```text
DocumentPresenter
NavigationPresenter
MainWindowPresenter
```

**Component Presenters** — application-independent, aware only of the behavior of their respective widget (could theoretically be reused in another application):

```text
TreeTablePresenter
DiagramPresenter
SyntaxPresenter
PropertyGridPresenter
SearchPresenter
```

Presenters take the generic View components and assemble them together into the application's screens. Most presenters need no CSS of their own; styling lives with the View components. CSS at the presenter level is only expected in the occasional case where a container or layout wrapper needs its own styling.

#### Views

Views and Presenters are the only place where HTML rendering and GUI-specific code is allowed.

Since this is a webapp, the Views layer contains the reusable building blocks of the application. These components are not universal web-application primitives (like a generic button library) — they are the specific building blocks this application is composed of (tree tables, diagram canvases, syntax widgets, property grids, and so on).

Each View component is kept as small as possible and is expressed as a pair:

- A `.tsx` file for the component definition — this behaves a little like a mini HTML fragment, describing structure and markup.
- A stylesheet imported into the `.tsx` — a scoped, mini CSS file containing only the styling for that one component.

Keeping the markup and styling scoped per component prevents Views from growing into large, monolithic files. Additional CSS beyond the per-component stylesheet is generally not needed; the exception is container or layout components that may require their own styling.

Views render based on presenter state and contain no business logic.

##### HTML and DOM policy

Everything is built in `.tsx` rather than using static HTML with ID hooks. Static HTML with `getElementById` access is avoided (see the "TSX Components Instead of Static HTML" design principle).

Consequently, `index.html` stays minimal. The `<body>` contains almost nothing — ideally just the single root mount point — while the `<head>` carries the document loads (stylesheets, fonts, meta tags, the module script entry point). The application tree is constructed entirely in TSX starting from `main.tsx`.

> **Open question:** How much, if anything, should remain as static HTML in the `<body>`? The current intent is "almost nothing in the body, loads in the head." This needs a firm decision once the shell layout is built — whether the body is a bare `<div id="root">` or whether a few structural anchors are justified.

#### Persistence

Responsible for serialization, storage backends, and import/export.

### Runtime Architecture

```text
                         USER
                           |
                           v

+---------------------------------------------------+
|                     Views                         |
|                                                   |
| TreeTableView                                     |
| DiagramView                                       |
| SyntaxView                                        |
+---------------------------------------------------+
                           ^
                           |
                           |
+---------------------------------------------------+
|             Component Presenters                  |
|                                                   |
| TreeTablePresenter                                |
| DiagramPresenter                                  |
| SyntaxPresenter                                   |
+---------------------------------------------------+
                           ^
                           |
                           |
+---------------------------------------------------+
|               App Presenters                      |
|                                                   |
| DocumentPresenter                                 |
| NavigationPresenter                               |
| MainWindowPresenter                               |
+---------------------------------------------------+
                 ^                   ^
                 |                   |
                 |                   |
                 |                   |
+-----------------------+   +----------------------+
|      Domain           |   |     StateManager     |
|                       |   |                      |
| Document              |   | SelectionState       |
| TreeTables            |   | ClipboardState       |
| Diagrams              |   | LayoutState          |
| Bookkeeping           |   | UndoManager          |
+-----------------------+   +----------------------+

                 ^
                 |
                 |
+-----------------------------------------------+
|               Syntax Engine                   |
|                                               |
| Lexer -> Parser -> AST -> Renderer            |
+-----------------------------------------------+

                 ^
                 |
                 |
+-----------------------------------------------+
|                Persistence                    |
|                                               |
| FirebaseAdapter                               |
| ImportExport                                  |
| DocumentStorage                               |
+-----------------------------------------------+
```

```text
                               APPLICATION

+--------------------------------------------------------------+
|                      Document Model                          |
|                                                              |
|  TreeTables     Diagrams      Expressions     Bookkeeping    |
|                                                              |
+--------------------------------------------------------------+
                    ^                     ^
                    |                     |
                    |                     |
             read/change            parse/render
                    |                     |
                    |                     |
+--------------------------------------------------------------+
|                     App Presenters                           |
|                                                              |
|  DocumentPresenter                                           |
|  MainWindowPresenter                                         |
|  NavigationPresenter                                         |
|                                                              |
+--------------------------------------------------------------+
                    ^
                    |
                    |
+--------------------------------------------------------------+
|                Component Presenters                          |
|                                                              |
|  TreeTablePresenter                                          |
|  DiagramPresenter                                            |
|  SyntaxPresenter                                             |
|  SearchPresenter                                             |
|  PropertyGridPresenter                                       |
|                                                              |
+--------------------------------------------------------------+
                    ^
                    |
                    |
+--------------------------------------------------------------+
|                         Views                                |
|                                                              |
|  TreeTableView.tsx                                           |
|  DiagramView.tsx                                             |
|  SyntaxView.tsx                                              |
|  PropertyGridView.tsx                                        |
|                                                              |
+--------------------------------------------------------------+
                    ^
                    |
               User Input
```

```text
+------------------------------------------------------+
| Application Model                                    |
|                                                      |
|  Document                                             |
|      |- TreeTables                                    |
|      |- Diagrams                                      |
|      |- Bookkeeping                                   |
|      |- Expressions                                   |
|                                                      |
+------------------------------------------------------+
                     ^
                     |
                     |
+------------------------------------------------------+
| App Presenters                                       |
|                                                      |
|  DocumentPresenter                                   |
|  NavigationPresenter                                 |
|  SearchPresenter                                     |
|                                                      |
+------------------------------------------------------+
                     ^
                     |
                     |
+------------------------------------------------------+
| App-independent Presenters                           |
|                                                      |
|  TreeTablePresenter                                  |
|  DiagramPresenter                                    |
|  SyntaxPresenter                                     |
|  PropertyGridPresenter                               |
|                                                      |
+------------------------------------------------------+
                     ^
                     |
                     |
+------------------------------------------------------+
| Views                                                |
|                                                      |
|  TreeTableView.tsx                                   |
|  DiagramView.tsx                                     |
|  SyntaxView.tsx                                      |
|                                                      |
+------------------------------------------------------+
```

```text
+------------------------+
|   App Presenter        |
+------------------------+
            |
            v
+------------------------+
| Component Presenter    |
+------------------------+
            |
            v
+------------------------+
|       View             |
+------------------------+

            ^
            |
+------------------------+
|      Domain            |
+------------------------+
```

---

## Design Principles

### File Extension Convention

Use `.tsx` when JSX is present. Use `.ts` for pure logic.

A file should be `.tsx` if it contains JSX syntax:

```tsx
function Button() {
    return <button>Click me</button>;
}
```

The TypeScript compiler requires the `.tsx` extension to parse JSX.

A file should be `.ts` if it contains only:

- Business rules
- Domain models
- Data structures
- Utility functions
- API clients
- Validation logic

```ts
export class Account {
    constructor(
        public readonly id: string,
        public balance: number
    ) {}
}

export function calculateBalance(
    debits: number[],
    credits: number[]
): number {
    return credits.reduce((a, b) => a + b, 0)
         - debits.reduce((a, b) => a + b, 0);
}
```

Summary:

- `.ts` → business logic, domain logic, infrastructure
- `.tsx` → UI/presentation logic

Dependencies should flow one way: `.tsx` imports `.ts`, not the reverse. A `.ts` file may import types from `.tsx` if necessary, but the preferred direction is `TSX → TS`.

### TSX Components Instead of Static HTML

Layout is expressed through React components rather than static HTML with ID-based DOM access.

Instead of:

```html
<div id="sidebar"></div>
<div id="toolbar"></div>
<div id="content"></div>
```
```js
document.getElementById("sidebar")
```

Use:

```tsx
export function Layout() {
    return (
        <div className="app">
            <Sidebar />
            <Toolbar />
            <Content />
        </div>
    );
}
```

Benefits:

- Type safety
- Component reuse
- Easier state management
- Easier testing
- Better maintainability
- No manual DOM manipulation

In a Vite React project, `index.html` remains minimal:

```html
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
```

IDs are reserved for:

- Accessibility relationships (`aria-labelledby`, etc.)
- Anchor links
- Rare third-party DOM integrations

---

## Future: Porting to C++

The architecture is designed to be portable. A future C++ implementation is anticipated.

Performance context for native targets:

- Integer addition: ~1 cycle
- Floating-point multiply: a few cycles
- An inlined function call: effectively free
- L1 cache miss: tens of cycles
- L2 cache miss: more
- L3 cache miss: hundreds of cycles
- DRAM access: hundreds of cycles (often 200–400+ depending on the platform)

The CPU is often waiting on memory rather than doing arithmetic. Data layout and cache locality will be primary concerns in the native port.

---

# Phase 1 — Syntax Parsers

## Goals

1. Define a rigorous math grammar. Common cases use mnemonics; less common constructs use full keywords. The grammar must support step-by-step notations and semantic operators (`\deriv` for derivative, `\pderiv` for partial derivative, `\jac` for Jacobian) instead of typographical conventions like `d/(dx)`.

2. Eliminate ambiguities in identifier recognition. The parser must distinguish between:
   - Standard mathematical compound symbols (`\sin`, `\cos`, `\tan`, `\ln`)
   - Greek letters (`\a` = α, `\b` = β, `\g` = γ)
   - Hebrew letters (`\ha` = ℵ, `\hb` = ℶ, `\hg` = ℷ)
   - Plain identifiers, left-skew and right-skew variants, blackboard bold

   Define what the mathematical syntax should produce for each category and update test cases accordingly.

3. Apply the architecture defined in Phase 0 as the program skeleton — restructure `src/` to match the planned directory layout.

4. Define additional renderable syntaxes (geometry, physics, chemistry) with corresponding test cases.

5. Define non-renderable syntaxes for data purposes (JSON/CSV syntax) with corresponding test cases.

## Syntax Design Architecture

The syntax subsystem is designed as an independent compiler pipeline. Syntax definitions are treated as data rather than application code.

```
Syntax Source
        |
        V
Syntax Compiler
        |
        V
Compiled Syntax Package
        |
        V
Editor Runtime
        |
        V
Lexer
        |
        V
PEG Parser
        |
        V
AST
        |
        V
Renderer
```

The long-term objective is for syntaxes to be distributed independently of the editor executable. Instead of compiling grammars into the application, the editor loads compiled syntax packages produced by a dedicated syntax compiler.

This architecture provides several advantages:

- Syntaxes can be updated without rebuilding the editor;
- Expensive grammar analysis is performed only once during compilation;
- Compiled grammars may contain optimized parser tables or parser bytecode;
- Syntax packages can be versioned independently from the editor;
- Third parties can develop additional syntaxes without modifying the core application.

Compiled syntax packages should serialize logical grammar structures rather than raw memory. Runtime pointers must never be written directly to disk. Instead, references should be represented using indices or identifiers so the runtime can reconstruct internal structures when loading.

Eventually the syntax compiler may introduce an intermediate representation (IR):

```
Syntax Source
        |
        V
Syntax AST
        |
        V
Grammar IR
        |
        +-- Validation
        +-- Optimization
        +-- Serialization
        |
        V
Compiled Syntax Package
```

This allows the compiler and runtime to evolve independently while keeping the serialization format stable.

### The Syntax Compiler

The syntax compiler is part of the syntax subsystem (`src/syntax/compiler/`), not a generic `lib/` dependency. Although it does not know about any specific domain (math, chemistry, etc.), it is tightly coupled to application-specific concerns: the meta-syntax used to define grammars, the compiled-package serialization format, and the runtime interpreter that consumes those packages. It is therefore bespoke application infrastructure rather than reusable library code.

The genuinely reusable, domain-ignorant core is the **PEG engine** (`lib/peg-parser/AbstractParser`). The compiler is the application-specific orchestration built *around* that generic core — it uses the PEG engine but belongs to the syntax subsystem.

This resolves a design tension around custom DSL compilation. If compilation is embedded directly into the webapp as a first-class user platform, it risks turning the whole application into a DSL platform; but if it is removed entirely, a *separate* application would be required to compile DSLs, which reintroduces a "mounting" problem — getting the produced package back into the app.

Keeping the compiler as an internal subsystem module (rather than either a user-facing platform or an external tool) avoids both extremes. It is invoked through one controlled surface — the in-app DSL editor — and its output is written straight to persistence. If an offline or batch CLI is ever wanted, it can import the same `src/syntax/compiler/` module; that remains an optional future consideration rather than a requirement.

Note on terminology: "compiled binary" here does not mean native machine code. A browser cannot and should not produce native executables. A "compiled syntax package" is a compact **serialized grammar artifact** (for example JSON, MessagePack, or a typed-array blob) that the TypeScript runtime interprets. It is data, not an executable.

### In-App DSL Editor

Custom DSLs are authored inside the application through a dedicated DSL editor surface (`DslEditorView` / `DslEditorPresenter`). This makes compiling and saving a single act — there is no external file handoff and therefore no mounting step. The output package never leaves the application boundary; it is written straight to the persistence layer.

```text
User writes DSL source (in-app DSL editor)
        |
        v
Compiler (src/syntax/compiler) produces a package
        |
        v
Saved directly to persistence
        ├── IndexedDB (local, offline-capable)
        └── Firebase (cloud sync, when a session exists)
        |
        v
Immediately available to the editor runtime — no mounting, no file handoff
```

### Bundled vs. Loaded Syntaxes (Hybrid)

The editor uses a hybrid loading strategy:

- **Bundled standard syntaxes** (math, and eventually chemistry, physics, etc.) ship with the application as static assets and load instantly at startup via `fetch()`. These work offline and require no network round-trip. They are effectively "etched in."
- **Custom / additional syntaxes** are loaded dynamically at runtime — authored in the in-app DSL editor, or imported by the user, or synced from cloud storage.

This keeps startup fast in the common case while preserving extensibility.

### Security Constraint

Because users author and load syntax packages, the runtime must always treat a package as **declarative data**. It must never `eval` or execute code embedded in a package. Interpreting a grammar table or parser bytecode is safe; executing arbitrary shipped code would be a security hole. Keeping packages purely declarative — and controlling the compiler output format end to end via the in-app editor — makes this guarantee enforceable.

## Syntax Design Principles

The standard syntax intentionally prioritizes semantic clarity and deterministic parsing over reproducing traditional handwritten notation.

Traditional mathematical notation evolved for human readers and contains numerous ambiguities that complicate parsing. The syntax therefore adopts several guiding principles.

### Explicit Syntax Over Implicit Syntax

Implicit multiplication introduces substantial ambiguity.

Examples include:

```
3x
xy
2(x+1)
sin x
e^x
```

Each expression requires contextual interpretation before its meaning can be determined.

Instead, multiplication is always written explicitly:

```
3*x
x*y
2*(x+1)
sin(x)
exp(x)
```

The parser should never infer multiplication from adjacency.

The renderer may later omit multiplication symbols for display purposes, but the source language remains explicit.

### Context-Free Parsing

The parser determines the syntax tree without relying on semantic knowledge.

For example,

```
sin(x)
```

is parsed as an ordinary function call.

Whether `sin` is a predefined mathematical function or a user-defined identifier is determined during semantic analysis rather than parsing.

Likewise,

```
foo(x)
```

is syntactically identical.

This separation keeps the grammar deterministic and extensible.

### Multi-Character Identifiers

Identifiers are not decomposed into implicit products.

For example, `velocity` is always a single identifier.

Similarly,

```
sin
cos
tan
deriv
int
jacobian
```

are ordinary identifiers that happen to have predefined meanings within the mathematics package.

The parser does not distinguish between built-in and user-defined identifiers.

### Surface Syntax Versus Semantic Representation

The source syntax exists solely for user interaction.

Immediately after parsing, expressions are transformed into semantic AST nodes.

For example,

```
\deriv(x, x^3)
```

becomes

```
Derivative
+-- Variable = x
└-- Body = x^3
```

Similarly,

```
int(x, 1, 2, exp(-x))
```

becomes

```
Integral
+-- Variable = x
+-- Lower = 1
+-- Upper = 2
└-- Body = exp(-x)
```

Subsequent simplification, differentiation, symbolic manipulation, and rendering operate exclusively on semantic nodes rather than textual notation.

### Mathematical Operators Are Not Encoded as Arithmetic

Traditional notation frequently represents operators using symbols that resemble arithmetic expressions despite having different semantics.

For example,

```
d/(dx)
```

resembles a fraction but is actually a differentiation operator.

Likewise,

```
∂/∂x
```

is not division.

The syntax therefore introduces dedicated language constructs instead of relying on typographical conventions.

Examples include:

```
deriv(variable, expression)
pderiv(variable, expression)
jacobian(function, variables...)
```

These forms eliminate ambiguities while directly expressing the intended semantics.

### Unicode-Independent Source Representation

The source language remains entirely ASCII.

Unicode mathematical symbols are introduced through explicit escape sequences.

Examples include:

```
\a      α (Alpha)
\b      β (Beta)
\g      γ (Gamma)

\ha     ℵ (Aleph)
\hb     ℶ (Beth)
\hg     ℷ (Gimel)
```

### Mathematical Syntax Design Goals

The mathematical language is designed primarily as a semantic language rather than a typesetting language.

Consequently:

- Explicit syntax is preferred over handwritten shorthand;
- Every construct should have a unique parse tree;
- Every parse tree should correspond to a unique semantic representation;
- Rendering may later recover traditional mathematical notation without affecting the underlying semantics.

This philosophy deliberately separates how mathematics is written from how mathematics is represented internally, allowing symbolic manipulation, simplification, rendering, and future language extensions to operate on a clean and unambiguous semantic model.

### General DSL Design Principles

The same design philosophy extends beyond mathematical notation to every domain-specific language supported by the editor. Each DSL should resemble the conventional textual notation of its domain as closely as possible, provided that doing so does not introduce ambiguity or compromise the underlying semantic model. When traditional notation relies on implicit conventions or contextual interpretation, the DSL instead adopts explicit constructs that preserve the intended meaning while remaining deterministic to parse.

The objective is not to reproduce handwritten notation exactly, but to preserve the conceptual structure familiar to domain experts. Users should be able to recognize expressions immediately without requiring unnecessary syntactic ceremony, while the compiler is able to construct a unique semantic representation from every valid source.

Different domains naturally favor different textual representations. For example, mathematical expressions are commonly written using algebraic notation, chemical reactions are often expressed using reaction equations, and digital logic is frequently specified using Boolean algebra. These established textual forms generally provide a more suitable foundation for DSLs than their graphical counterparts because they are concise, linear, and well suited for parsing.

Graphical representations remain important, but they are treated as visualizations of the underlying semantic model rather than the canonical source language. A Boolean expression may be rendered as a logic gate diagram, a mathematical expression may be rendered using conventional typesetting, and a chemical structure may be rendered as a structural diagram. The source language and the graphical representation therefore become two complementary projections of the same semantic information rather than competing representations.

This principle reinforces a central theme of the architecture: the semantic model is canonical; text and diagrams are interchangeable views of that model.

## Mathematical Syntax Design

TODO: Define the complete mathematical grammar specification here.

## Syntax for Geometry

TODO: Define the geometry DSL specification here.

---

# Phase 2 — Domain

The domain layer holds the persistent, serializable document data. It is defined in two parts, following the compositional model below: **Part A — Content and Composition** (how knowledge is encoded and composed, independent of where it is placed) and **Part B — Layout** (how composed cells are arranged into tables and diagrams). This split keeps the shared content model separate from the structure-specific layout rules.

## Compositional Model

Knowledge is organized as a three-level compositional hierarchy. Each level is an arrangement of the level below it — the same principle by which simple pieces are organized into larger structures (analogous to how logic gates form circuits, or algorithms form software). The names below are deliberately domain-specific and are **not** related to software architecture or CPU microarchitecture.

```text
Box    → a single semantically-encoded object (one DSL expression)
Group  → an ordered list of boxes within one cell / diagram entry
Layout → an arrangement of cells into a table, or of entries into a diagram
```

| Level | Definition |
|---|---|
| **Box** | The atomic unit. One box holds one `(syntax type, source)` pair — a single DSL expression such as a formula, a chemical reaction, or a boolean expression. Each box is parsed and rendered by exactly one syntax. |
| **Group** | An ordered list of typed boxes occupying a single table cell or diagram entry. The container of boxes. |
| **Layout** | The arrangement of cells/entries. In a table, cells are placed in rows and columns; in a diagram, entries are placed arbitrarily and connected by edges. |

### Part A — Content and Composition (Box and Group)

A Box is a single typed unit: `(syntax type, source)`. The syntax type selects which DSL grammar parses and renders the box's source. A box never mixes syntaxes.

A Group is an **ordered list of boxes**, not a rich-text block. This is a deliberate decision.

**Decision: typed list of boxes, not inline mode-switching rich text.**

The rejected alternative is a single rich-text stream that escapes into and out of modes inline:

```text
Some text $math{5x^2} more text $chem{H2O} ...
```

This is avoided because:

- Inline mode markers (`$math{`, `$chem{`) are visual noise scattered through the content, hurting readability.
- Requiring the user to type `$math{...}` every time to enter a mode is unnecessary ceremony.
- It forces a single parser to understand all syntaxes at once, or to constantly hand off between them, reintroducing the contextual ambiguity that the Phase 1 "context-free parsing" principle is designed to eliminate.

Instead, a Group is modeled as a list where each box declares its type **once, structurally**:

```text
Group
+-- Box(type = text,  source = "Some text")
+-- Box(type = math,  source = "5x^2")
+-- Box(type = text,  source = "more text")
└-- Box(type = chem,  source = "H2O")
```

Advantages:

- Zero marker noise inside the content — the type is metadata on the box, not an inline escape.
- Each box is parsed by exactly one syntax; the math parser never has to know chemistry exists. Every DSL grammar stays closed and context-free, honoring the Phase 1 design principles.
- The box type is chosen at the UI level (the user picks what to write next), not typed as syntax ceremony.
- Boxes are independently compilable and renderable — a math box produces a math AST, a chem box produces a chem AST, with no shared super-grammar.

> **Open question:** Is a Group a purely linear list (reading order only), or does it need light internal arrangement (wrapping, alignment, stacking)? The MVP is a plain ordered list; richer within-group arrangement is a possible future extension.

### Part B — Layout (arrangement of cells)

A Layout arranges cells (each containing a Group) into a larger structure. There are two concrete forms:

- **Table (TreeTable):** cells arranged in a hierarchical row/column structure.
- **Diagram:** entries placed arbitrarily in space and connected by **edges**. Edge connectivity is a first-class Layout concern, not just placement.

Bookkeeping structures (accounts, transactions, journals) are also domain data defined at this level.

> **Open question:** Table cells and diagram entries share the Group concept (Part A), but their Layout-level arrangement rules differ (grid vs. free placement + edges). Confirm whether Layout is best modeled as one abstract concept with two concrete forms, or as two separate structures that both consume Groups.

## Implementation Scope

TODO: Define the concrete data structures for TreeTable, Diagram, and Bookkeeping, their relationships, and the serialization format — building on the Box → Group → Layout model above.

---

# Phase 3 — State Managers

TODO: Define the editor runtime state layer — selection, clipboard, undo/redo, layout state, and the event notification mechanism that propagates changes across subsystems.

---

# Phase 4 — Presenters and Views

1. Add mathematical syntax rendering. By this phase, behaviors are validated using test cases. However, behaviors should also manifest in the webapp. This is accomplished by creating a separate playground page dedicated to trying individual features, including mathematical syntaxes. The playground serves simultaneously as interactive documentation, a feature tester, and a manual troubleshooting interface. (Automated tests remain the primary validation mechanism.)

---

# Phase 5 — Persistence

TODO: Define the persistence layer — document serialization format, storage backend abstraction, Firebase adapter, and import/export functionality.

## Storage Targets

The persistence layer abstracts over two storage backends, and data is written to both where applicable:

- **IndexedDB** — local, in-browser storage. Provides offline capability and fast startup.
- **Firebase** — cloud storage. Provides cross-device sync when a session exists.

A web application cannot treat the native filesystem as a source of truth (even with `showSaveFilePicker` / `showOpenFilePicker`, access is limited and permission-gated). The native filesystem is therefore used only for **import/export**, never as primary storage. IndexedDB is the local source of truth; Firebase is the cloud mirror.

## Syntax Package Storage

Compiled syntax packages authored in the in-app DSL editor (see Phase 1) are a persistence concern, handled by `SyntaxPackageStorage`. Every custom package is:

- saved to **IndexedDB** for local, offline use, and
- mirrored to **Firebase** when a cloud session is available.

Bundled standard syntaxes are not stored here — they ship as static assets and load via `fetch()` at startup. Only custom/imported packages flow through `SyntaxPackageStorage`.

This means the in-app DSL editor never has to worry about "mounting" a compiled package: saving to the persistence layer *is* the loading path. A package saved to IndexedDB/Firebase is immediately available to the editor runtime.
