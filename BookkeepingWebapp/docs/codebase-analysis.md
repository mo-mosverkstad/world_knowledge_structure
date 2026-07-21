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
+-- src/
|
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
|   |   +-- rendering/
|   |       |
|   |       +-- ExpressionRenderer.ts
|   |       +-- MathRenderer.ts
|   |
|   |
|   +-- presenters/
|   |   |
|   |   +-- app/
|   |   |   |
|   |   |   +-- DocumentPresenter.ts
|   |   |   +-- NavigationPresenter.ts
|   |   |   +-- MainWindowPresenter.ts
|   |   |
|   |   +-- components/
|   |       |
|   |       +-- TreeTablePresenter.ts
|   |       +-- DiagramPresenter.ts
|   |       +-- SyntaxPresenter.ts
|   |       +-- PropertyGridPresenter.ts
|   |       +-- SearchPresenter.ts
|   |
|   |
|   +-- views/
|   |   |
|   |   +-- app/
|   |   |   |
|   |   |   +-- MainWindow.tsx
|   |   |   +-- NavigationBar.tsx
|   |   |
|   |   +-- components/
|   |       |
|   |       +-- TreeTableView.tsx
|   |       +-- DiagramView.tsx
|   |       +-- SyntaxView.tsx
|   |       +-- PropertyGridView.tsx
|   |       +-- SearchView.tsx
|   |
|   |
|   +-- persistence/
|   |   |
|   |   +-- DocumentStorage.ts
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
|   |   +-- EventBus.ts (or Observable.ts / Notifier.ts)
|   |
|   |
|   +-- main.tsx
|
+-- package.json
```

**Decision:** Expressions belong under `syntax/` rather than `domain/`, because expressions involve parsing, AST construction, grammar definitions, and rendering — forming a subsystem rather than pure data. Domain concepts (TreeTables, Diagrams, Bookkeeping) remain under `domain/`.

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

Split into two categories:

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

#### Views

React components (`.tsx`) that render based on presenter state. Contain no business logic.

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

TODO: Define the domain model implementation — TreeTable, Diagram, and Bookkeeping data structures, their relationships, and serialization format.

---

# Phase 3 — State Managers

TODO: Define the editor runtime state layer — selection, clipboard, undo/redo, layout state, and the event notification mechanism that propagates changes across subsystems.

---

# Phase 4 — Presenters and Views

1. Add mathematical syntax rendering. By this phase, behaviors are validated using test cases. However, behaviors should also manifest in the webapp. This is accomplished by creating a separate playground page dedicated to trying individual features, including mathematical syntaxes. The playground serves simultaneously as interactive documentation, a feature tester, and a manual troubleshooting interface. (Automated tests remain the primary validation mechanism.)

---

# Phase 5 — Persistence

TODO: Define the persistence layer — document serialization format, storage backend abstraction, Firebase adapter, and import/export functionality.
