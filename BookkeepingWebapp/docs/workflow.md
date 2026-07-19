# Workflow

The application project is developed through a series of phases. It begins with a pre-study phase (Phase 0), where the project is defined at a high level. The outcome of this phase serves as the guide for the remaining implementation phases.

Since the project is often too large to comprehend as a whole, its requirements are first analyzed and decomposed into smaller, high-level components. During the study phase, new ideas and considerations naturally arise. These ideas should be recorded as they appear, since it is common to focus on one aspect of the project while temporarily overlooking others. As development progresses, it is easy to forget previously discovered solutions or design ideas, resulting in repeated design iterations or unnecessary dead ends. Recording these ideas early helps preserve design decisions throughout the project.

```
Phase 0 — Project Study

0.1 Vision and Motivation
    - Purpose
    - Scope
    - Constraints

0.2 Requirements
    - Functional
    - Non-functional
    - Domain model

0.3 UI/UX Specification

0.4 Architecture
    - High-level architecture
    - Subsystem architecture
    - Module architecture
    - Interface definitions

0.5 Algorithm Design
    - Functional specifications
    - Candidate implementations
    - Complexity expectations
    - Benchmark plan

0.6 Repository Structure
    - Directory layout
    - Naming conventions

0.7 Task Breakdown
    - Atomic tasks
    - Dependencies
    - Milestones

0.8 Decision Log
    - Design decisions
    - Alternatives
    - Rationale

0.9 Risk Assessment
    - Technical risks
    - Unknowns
    - Mitigation strategies

--------------------------------------

Phase 1
Core Infrastructure

Phase 2
Core Domain Implementation

Phase 3
User Interface

Phase 4
Algorithm Optimization

Phase 5
Benchmarking

Phase 6
Testing and Validation

Phase 7
Documentation and Release
```

## Phase 0 – Pre-study

Phase 0 is reserved for the pre-study of the application. During this phase, the project requirements, architecture, and implementation plan are defined. Together, they form the scaffold of the project, allowing new functionality to be integrated into an already established structure.

Once this scaffold has been defined, it should remain stable throughout the project. Minor adjustments at the local architectural level may still be necessary, but modifications to the global architecture are strongly discouraged unless they are absolutely required.

The pre-study consists of the following steps.

### Step 1 – Software Concept Definition

The first step is to define the software concept and user interface.

This includes the complete specification of the desired software, the domain model, and the user interface. In addition, any design considerations, motivations behind the product, assumptions, limitations, and other supporting notes should also be documented.

Decision logs...

### Step 2 – Project Structure

The second step is to define the project's folder structure and initial filenames.

Although filenames may change during implementation, this step provides a more concrete scaffold of the software and establishes an organized project structure before development begins.

### Step 3 – Task Decomposition

The third step is to decompose the project into implementation phases and atomic tasks.

Tasks may correspond to architectural components, algorithms, or other implementation units. Each phase should consist of sufficiently small and well-defined tasks that can be implemented, tested, and verified independently.

### Step 4 – Architecture Design

The fourth step is the architectural design at multiple abstraction levels.

The architecture defines the structural organization of the software while remaining independent of specific algorithms or detailed performance considerations. Its purpose is to establish a scalable, maintainable, and extensible structure upon which the implementation can be built.

The architecture is divided into multiple levels. The highest level defines the overall architectural pattern, such as MVC, MVP, or any custom architecture that satisfies the project's design goals. Lower levels progressively refine the structure until reaching the algorithm interface layer, where the architecture interacts with concrete algorithm implementations.

### Step 5 – Algorithm Design

The algorithm layer defines the behavior behind each functional interface.

A single functional definition may have multiple algorithm implementations. In many cases, the functional definition specifies only the required behavior, while implementation details such as time complexity, memory usage, latency characteristics, or other performance properties are left to the individual algorithm.

All algorithms implementing the same functional definition shall expose the same interface, allowing them to be exchanged without affecting the surrounding architecture.

At minimum, a naive reference implementation shall be provided for comparison. Additional optimized or experimental algorithms may also be implemented. Benchmark testing shall then be conducted using randomized datasets of varying sizes to evaluate correctness and performance characteristics.

## Phase 1 and Beyond

Phase 1 and all subsequent phases are dedicated to implementation.

Each implementation phase follows the scaffold established during Phase 0. New functionality is integrated into the predefined architecture while maintaining consistency with the original design. Minor local improvements may be introduced when necessary, but the overall architecture should remain stable throughout the development process.

### Step 1 - Architecture scaffolding
...

### Step 2 - Algorithm implementation, unit testing and benchmark testing
...

### Step 3 - Higher unit tests
...