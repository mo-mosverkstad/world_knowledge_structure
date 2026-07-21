# Codebase Analysis

IMPORTANT TODO: Clean the draft in codebase analysis and fill sentences

# Phase 0 - Environment setup and architecture definition

## Domain model

The application models a cheat sheet collection rather than a collection of independent documents. A cheat sheet is therefore considered a projection of an underlying semantic model instead of the owner of the knowledge it displays.

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

Knowledge is organized into collations. A collation is the definition of table width and judges how the related knowledge will be grouped. Examples include chemical classifications, collections of physical constants, mathematical theorems, problem-solving patterns, programming concepts, and similar domains.

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

## Inbox storage as scratchpad

A scratchpad is a reasonable solution, and it fits naturally into your model if you treat it as an **inbox** rather than part of the permanent knowledge hierarchy.

One possible workflow is:

```text
Scratchpad
    ↓
Organize
    ↓
Layout hierarchy
    ↓
Published cheat sheet
```

The scratchpad is intentionally unstructured. Whether someting belongs in a particular layout or hierarchy is not immediately decided.

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

From a domain perspective, `Scratchpad` as a subtype of `TableNode` is avoided. Instead, make it a separate aggregate because its semantics are different:

```text
Workspace
+-- Scratchpad
+-- Layout Hierarchies
└-- Search Index
```

or

```text
KnowledgeBase
+-- Inbox
+-- Collections
└-- Index
```

This is similar to how many personal knowledge management systems distinguish **capture** from **organization**. The inbox is optimized for quickly recording ideas, while the organized hierarchies are optimized for retrieval and long-term maintenance.

The key distinction is that a scratchpad item has **no assigned layout, no permanent location, and no semantic commitment** until you decide where it belongs. That keeps your main model clean while still supporting spontaneous note capture.


## Architecture

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
|   |   |   |
|   |   |   +-- Account.ts
|   |   |   +-- Transaction.ts
|   |   |   +-- Journal.ts
|   |   |
|   |   +-- expressions/ ??? May be removed out to syntax
|   |       |
|   |       +-- Expression.ts
|   |       +-- Formula.ts
|   |
|   |
|   +-- syntax/
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
|   |
|   |
|   +-- main.tsx
|
+-- package.json


---
Editor layers:

```text
src/

+-- domain/
+-- syntax/
+-- statemanager/
+-- presenters/
+-- views/
+-- persistence/
```

The responsibilities become:

***

## Domain

Persistent document data.

```text
Document
+-- TreeTables
+-- Diagrams
+-- Expressions
+-- Bookkeeping
```

Everything here should be savable.

Example:

```text
Tree row hierarchy
Cell contents
Formula source
Diagram nodes
Account transactions
```

belong here.

***

## State Manager

Editor runtime state.

```text
Selection
Clipboard
Undo Stack
Layout
```

These are not part of the document itself.

For example:

```text
Document:
    TreeTable A exists

State:
    Row 42 is selected
```

Selection should not end up serialized into the document unless explicitly desired.

***

## Syntax

A completely separate subsystem.

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

This is essentially a mini compiler.

***

## Presenters

Here I think your split is excellent:

```text
presenters/
|
+-- app/
|
+-- components/
```

I would think about them as:

### App Presenter

Knows:

```text
Document
Persistence
Navigation
Search
```

Examples:

```text
DocumentPresenter
NavigationPresenter
MainWindowPresenter
```

These are bookkeeping-editor specific.

***

### Component Presenter

Knows:

```text
Table behavior
Diagram behavior
Syntax widget behavior
```

Examples:

```text
TreeTablePresenter
DiagramPresenter
SyntaxPresenter
```

These could theoretically be reused in another application.

---

# One thing considering adding

Considering adding:

```text
statemanager/

+-- Command.ts
+-- UndoManager.ts
+-- SelectionState.ts
+-- ClipboardState.ts
+-- LayoutState.ts
+-- EventBus.ts
```

or

```text
Observable.ts
```

or

```text
Notifier.ts
```

depending on how you're implementing model notifications.

Because eventually you'll have:

```text
TreeTable changed

Diagram changed

Selection changed

Undo stack changed
```

and you'll need some way to propagate updates.

***

# Runtime Architecture

Drawing the runtime architecture as this:

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

***

# One Final Suggestion

I would consider moving:

```text
expressions/
```

out of `domain/`.

Because from your descriptions, expressions are not merely data:

```text
Expression
Formula
AST
Grammar
Rendering
```

That's almost an entire subsystem.

So I might eventually evolve toward:

```text
domain/
+-- document/
+-- treetable/
+-- diagrams/
+-- bookkeeping/

syntax/
+-- expressions/
+-- definitions/
+-- ast/
+-- parser/
+-- rendering/
```

This would make it clearer that:

```text
Bookkeeping
Diagrams
TreeTables
```

are domain concepts,

while

```text
Formulas
Parsing
AST
Rendering
```

belong to the syntax engine.

Other than that, I think this structure is quite solid for a large editor and noticeably more scalable than a typical React project where everything ends up under `components/` and `hooks/`.


---


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


Runtime architecture:
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

Architecture:
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



## Design principles

### tsx and ts mixed
Use .tsx when JSX is present
A file should be .tsx if it contains:
TypeScript
function Button() {
    return <button>Click me</button>;
}
The TypeScript compiler needs the .tsx extension to parse JSX syntax.

---

Use .ts for pure logic
A file should be .ts if it contains only:

Business rules
Domain models
Data structures
Utility functions
API clients
Validation logic


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

.ts → business logic + domain logic + infrastructure
.tsx → UI/presentation logic

A .tsx file can import a .ts file, And a .ts file can import types from a .tsx file if needed, though it's usually cleaner to keep UI dependencies flowing one way:
TSX ---> TS rather than TS <--- TSX

## tsx components instead of static HTML

Instead of
```html
<div id="sidebar"></div>
<div id="toolbar"></div>
<div id="content"></div>
```
```js
document.getElementById("sidebar")
```

Use
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

Type safety
Component reuse
Easier state management
Easier testing
Better maintainability
No manual DOM manipulation

Keep HTML Minimal
In a Vite React project, index.html is usually tiny:
```html
<body>
    <div id="root"></div>
    /src/main.tsx
</body>
```

Avoid IDs for Layout

IDs are best reserved for:
- Accessibility relationships
- Anchors
- Rare DOM integrations


---

# Porting to codebase versions in other platforms

Porting to C++ (future)
For many workloads:

Integer addition: ~1 cycle
Floating-point multiply: a few cycles
An inlined function call: effectively free
L1 cache miss: tens of cycles
L2 cache miss: more
L3 cache miss: hundreds of cycles
DRAM access: hundreds of cycles (often 200–400+ depending on the platform)

So the CPU is often waiting on memory rather than doing arithmetic.

# Phase 1: Syntax parsers - Full math syntax test scope

Todo:
0. IMPORTANT TODO: Clean the draft in codebase analysis and fill sentences
1. Properly define the math grammar (Common cases first, less useful using mnemonics, then using full keywords). The grammar must also support step by step notations, make derivatives more semantically using (\deriv (derivative), \pderiv (partial derivative) and \jac (jacobian) instead of d/(dx)) and so on. Define a rigorous grammar here in phase before continuing
2. Remove any side effects of mathematical syntax (cannot identify Greek, Hebrew letters, etc). The parser must be able to tell the difference between standard mathematical compound symbols (\sin, \cos, \tan, \ln), Greek letters (alpha: \a, beta: \b, gamma: \g) and Hebrew letters (aleph: \ha, beth: \hb, gimel: \hg). Also other following properties. Define what the mathematical syntax should produce + update test cases
3. Apply the architecture written in phase 0 of codebase-analysis (architecture definition) as program skeleton
4. Add more todos of renderable syntaxes, such as geometry, physics, chemistry syntaxes and so on + test cases
5. Add non-renderable syntaxes dedicated for other purposes, such as JSON/CSV syntax + test cases

Finish

## Syntax design architecture

The syntax subsystem is designed as an independent compiler pipeline rather than being embedded into the application domain. Syntax definitions are treated as data instead of application code.

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


The long-term objective is for syntaxes to be distributed independently of the editor executable. Instead of compiling grammars into the application, the editor loads compiled syntax packages produced bya dedicated syntax compiler.

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

## Syntax design principles

The standard syntax intentionally prioritizes semantic clarity and deterministic parsing over reproducing traditional handwritten notation.

Traditional mathematical notation evolved for human readers and contains numerous ambiguities that complicate parsing. The syntax therefore adopts several guiding principles.

### Explicit syntax over implicit syntax

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

### Context-free parsing

The parser should determine the syntax tree without relying on semantic knowledge.

For example,

```
sin(x)
```

is parsed as an ordinary function call.

Whether sin is a predefined mathematical function or a user-defined identifier is determined during semantic analysis rather than parsing.

Likewise,

```
foo(x)
```

is syntactically identical.

This separation keeps the grammar deterministic and extensible.

### Multi-character identifiers

Identifiers are not decomposed into implicit products.

For example, velocity is always a single identifier.

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

### Surface syntax versus semantic representation

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

Subsequent simplification, differentiation, symbolic manipulation and rendering operate exclusively on semantic nodes rather than textual notation.

Mathematical operators are not encoded as arithmetic

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

Unicode-independent source representation

The source language should remain entirely ASCII.

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

### Mathematical syntax design goals

The mathematical language is designed primarily as a semantic language rather than a typesetting language.

Consequently:
- Explicit syntax is preferred over handwritten shorthand;
- Every construct should have a unique parse tree;
- Every parse tree should correspond to a unique semantic representation;
- Rendering may later recover traditional mathematical notation without affecting the underlying semantics.

This philosophy deliberately separates how mathematics is written from how mathematics is represented internally, allowing symbolic manipulation, simplification, rendering, and future language extensions to operate on a clean and unambiguous semantic model.

General DSL design principles

The same design philosophy extends beyond mathematical notation to every domain-specific language supported by the editor. Each DSL should resemble the conventional textual notation of its domain as closely as possible, provided that doing so does not introduce ambiguity or compromise the underlying semantic model. When traditional notation relies on implicit conventions or contextual interpretation, the DSL instead adopts explicit constructs that preserve the intended meaning while remaining deterministic to parse.

The objective is not to reproduce handwritten notation exactly, but to preserve the conceptual structure familiar to domain experts. Users should be able to recognize expressions immediately without requiring unnecessary syntactic ceremony, while the compiler is able to construct a unique semantic representation from every valid source.

Different domains naturally favor different textual representations. For example, mathematical expressions are commonly written using algebraic notation, chemical reactions are often expressed using reaction equations, and digital logic is frequently specified using Boolean algebra. These established textual forms generally provide a more suitable foundation for DSLs than their graphical counterparts because they are concise, linear, and well suited for parsing.

Graphical representations remain important, but they are treated as visualizations of the underlying semantic model rather than the canonical source language. A Boolean expression may be rendered as a logic gate diagram, a mathematical expression may be rendered using conventional typesetting, and a chemical structure may be rendered as a structural diagram. The source language and the graphical representation therefore become two complementary projections of the same semantic information rather than competing representations.

I like this because it generalizes the philosophy you're already using for mathematics into a principle that can guide every future DSL (physics, chemistry, electronics, geometry, bookkeeping, etc.). It also reinforces one of the central themes of your architecture: the semantic model is canonical; text and diagrams are interchangeable views of that model.

## Mathematical syntax design

## Syntax for geometry

# Phase 2: Domain

# Phase 3: State managers

# Phase 4: Presenters + views (Tsx-oriented)

1. Add mathematical syntax rendering. Behaviors are validated using test cases by now. However, behaviors should also be able to manifest on Webapp as well. This can be done by creating a separate playground page aside of the application dedicated for trying different features parts, including mathematical syntaxes, both as a interactive documentation specification, a feature tester and a manual troubleshooting interface. (Tests are still needed)

# Phase 5: Persistance manager