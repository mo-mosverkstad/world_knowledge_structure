# Codebase Analysis

IMPORTANT TODO: Clean the draft in codebase analysis and fill sentences

# Phase 0 - Environment setup and architecture definition

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

├── domain/
├── syntax/
├── statemanager/
├── presenters/
├── views/
├── persistence/
```

The responsibilities become:

***

## Domain

Persistent document data.

```text
Document
├── TreeTables
├── Diagrams
├── Expressions
├── Bookkeeping
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

├── Command.ts
├── UndoManager.ts
├── SelectionState.ts
├── ClipboardState.ts
├── LayoutState.ts
├── EventBus.ts
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
├── document/
├── treetable/
├── diagrams/
├── bookkeeping/

syntax/
├── expressions/
├── definitions/
├── ast/
├── parser/
├── rendering/
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
3. Add mathematical syntax rendering. Behaviors are validated using test cases by now. However, behaviors should also be able to manifest on Webapp as well. This can be done by creating a separate try-it-on page aside of the application dedicated for trying different features parts, including mathematical syntaxes, both as a interactive documentation specification, a feature tester and a manual troubleshooting interface. (No test cases may be needed???)
4. Apply the architecture written in phase 0 of codebase-analysis (architecture definition) as program skeleton
5. Add more todos of renderable syntaxes, such as geometry, physics, chemistry syntaxes and so on + test cases
6. Add non-renderable syntaxes dedicated for other purposes, such as JSON/CSV syntax + test cases

Finish

# Phase 2: ...