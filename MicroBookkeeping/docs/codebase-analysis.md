# MicroBookkeeping

## 1. Project overview

**MicroBookkeeping** is a dedicated, solar-assisted, ultra-low-power hardware terminal for viewing, editing, and storing structured Bookkeeping documents.

It belongs to the broader Bookkeeping ecosystem:

* **Bookkeeping Desktop** — native C++ application for general-purpose computers.
* **Bookkeeping Webapp** — browser-based implementation.
* **MicroBookkeeping** — specialized embedded hardware for persistent, portable, offline access.

MicroBookkeeping is not intended to be a reduced desktop computer. It is a purpose-built information terminal designed specifically for Bookkeeping documents.

The device will support structured information composed of:

* rectangular and non-rectangular tables;
* independently positioned cells;
* text blocks;
* notes and annotations;
* diagrams;
* connectors and relationships;
* symbols and labels;
* arbitrary two-dimensional object placement.

The project will begin as a Raspberry Pi prototype, migrate to an Arduino-compatible microcontroller development board, continue on the same MCU without the Arduino framework, and eventually become a custom ultra-low-power circuit board.

***

## 2. Project purpose

General-purpose computers and mobile devices contain components and software that MicroBookkeeping does not require, including:

* high-performance application processors;
* illuminated displays;
* wireless subsystems;
* background operating-system services;
* large volatile memories;
* multimedia hardware;
* general-purpose user-interface frameworks.

MicroBookkeeping will instead prioritize:

1. extremely low average energy consumption;
2. persistent display without a backlight;
3. fast response to physical key input;
4. deterministic and understandable behavior;
5. local, offline storage;
6. long operating life from a rechargeable battery;
7. solar-assisted charging;
8. portability of Bookkeeping documents between platforms;
9. repairable and replaceable hardware where practical;
10. preservation of user ownership and control over data.

***

## 3. Product statement

> **MicroBookkeeping is a solar-assisted, ultra-low-power electronic terminal that provides a persistent physical interface for viewing, editing, and organizing structured Bookkeeping documents. It shares a common document model with the Bookkeeping Desktop and Webapp implementations while using a dedicated renderer, storage system, and keyboard-oriented interface optimized for constrained embedded hardware.**

***

## 4. Project scope

### 4.1 Included in the initial scope

The initial MicroBookkeeping product will provide:

* monochrome document rendering;
* arbitrary two-dimensional object placement;
* physical keyboard navigation;
* text insertion and deletion;
* object creation and movement;
* simple tables;
* diagram elements and connectors;
* document search;
* local document storage;
* crash-safe storage recovery;
* synchronization through a wired connection or removable transfer medium;
* multiple bitmap font packs;
* battery operation;
* solar-assisted battery charging;
* deep-sleep operation;
* partial display updates where supported.

### 4.2 Deferred capabilities

The following capabilities may be implemented later:

* wireless networking;
* cloud synchronization;
* touch input;
* handwriting;
* color display;
* audio;
* advanced vector graphics;
* full bidirectional multilingual editing;
* user-installable applications;
* scripting;
* desktop-equivalent document formatting;
* real-time collaborative editing.

### 4.3 Explicitly excluded from the initial product

MicroBookkeeping will not initially attempt to function as:

* a general-purpose computer;
* a web browser;
* a smartphone replacement;
* a media player;
* a Linux workstation;
* a programmable calculator platform;
* a general Arduino development device.

***

## 5. Design principles

The project will follow these principles.

### 5.1 Event-driven operation

The processor should remain asleep unless work is required.

Typical lifecycle:

```text
Deep sleep
    ↓
Keyboard interrupt
    ↓
Wake processor
    ↓
Read key event
    ↓
Modify affected document object
    ↓
Append storage journal record
    ↓
Render affected display tiles
    ↓
Perform partial display refresh
    ↓
Return to deep sleep
```

### 5.2 No continuous polling where avoidable

The system should avoid:

* continuous keyboard scanning;
* unnecessary timers;
* unnecessary display refreshes;
* background document processing;
* repeated full-document serialization;
* repeated full-screen rendering;
* active waiting for user input.

### 5.3 Portable core

The document model, layout engine, renderer, and storage format should not depend directly on:

* Linux;
* Raspberry Pi GPIO libraries;
* Arduino APIs;
* a particular MCU vendor;
* a particular display manufacturer.

### 5.4 Controlled resource use

The embedded implementation should prefer:

* fixed-capacity containers;
* bounded caches;
* explicit error handling;
* tile-based rendering;
* limited dynamic allocation;
* predictable storage writes;
* deterministic memory ownership.

### 5.5 Progressive constraint

The first prototype can use abundant resources, but it must measure and simulate the constraints of later hardware.

***

# 6. System architecture

## 6.1 High-level hardware architecture

```text
                          ┌───────────────────────┐
                          │      Solar panel      │
                          └───────────┬───────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │ Energy-harvesting and │
                          │ battery charger       │
                          └───────────┬───────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
          ┌───────────────────┐              ┌───────────────────┐
          │ Rechargeable      │              │ Power-good and    │
          │ protected battery │              │ voltage sensing   │
          └─────────┬─────────┘              └───────────────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ Low-quiescent-    │
          │ current regulator │
          └─────────┬─────────┘
                    │
       ┌────────────┼────────────┬──────────────┬─────────────┐
       │            │            │              │             │
       ▼            ▼            ▼              ▼             ▼
     MCU        E-paper      QSPI flash       FRAM         Keyboard
                 display                     optional        matrix
```

## 6.2 High-level software architecture

```text
MicroBookkeeping application
│
├── Document model
│   ├── Text objects
│   ├── Cells
│   ├── Tables
│   ├── Diagram elements
│   ├── Connectors
│   └── Annotations
│
├── Editing engine
│   ├── Commands
│   ├── Undo and redo
│   ├── Selection
│   └── Cursor management
│
├── Layout and viewport
│   ├── Object positioning
│   ├── Visibility testing
│   └── Spatial indexing
│
├── Rendering
│   ├── Tile renderer
│   ├── Bitmap font renderer
│   ├── Diagram renderer
│   └── Dirty-region manager
│
├── Persistence
│   ├── Document records
│   ├── Append-only journal
│   ├── Snapshots
│   ├── Indexes
│   └── Recovery
│
└── Platform abstraction
    ├── Display
    ├── Storage
    ├── Keyboard
    ├── Time
    ├── Power management
    └── Diagnostics
```

***

# 7. Display strategy

## 7.1 Selected initial display technology

The initial implementation will use a **monochrome Waveshare e-paper display** with SPI communication and, where available, partial-refresh support.

E-paper is suitable because it:

* is reflective and requires no backlight;
* retains its last image without continuous display power;
* provides a pixel-addressable two-dimensional canvas;
* can render tables, diagrams, connectors, and arbitrary glyphs;
* consumes most of its display energy during refresh rather than while showing a static page.

For example, Waveshare currently specifies its 5-inch 960 × 552 monochrome panel as supporting partial refresh, retaining its image without power, and consuming less than 50 mW during refresh under the manufacturer’s test conditions. [\[docs.waveshare.com\]](https://docs.waveshare.com/5inch_e-Paper)

## 7.2 Rejected initial display technology

A large 14-segment character array is not selected for the initial product.

A requested area of 128 × 96 character positions would contain:

```text
128 × 96 = 12,288 character positions
```

At 14 segments per character:

```text
12,288 × 14 = 172,032 segments
```

Commercial 14-segment products are commonly sold as single-character or small multi-character LED modules. Examples include single-character 0.4-inch modules and four-character modules, rather than integrated arrays containing thousands of character positions. [\[digikey.com\]](https://www.digikey.com/en/products/detail/kingbright/ACPSC04-41CGKWA/3084718), [\[digikey.com\]](https://www.digikey.com/en/products/detail/sparkfun-electronics/COM-21216/16892526)

Segmented displays would also make the following difficult or impossible:

* arbitrary diagrams;
* smooth connectors;
* custom table borders;
* Unicode glyphs;
* contextual Persian letter forms;
* combining marks;
* scalable font sizes;
* arbitrary object positioning.

## 7.3 Rendering method

MicroBookkeeping will use tile-based monochrome rendering.

Example tile configuration:

```text
Tile width:      32 pixels
Tile height:     32 pixels
Color depth:     1 bit per pixel
Storage per tile: 32 × 32 ÷ 8 = 128 bytes
```

The renderer will:

1. determine which objects have changed;
2. calculate the affected screen rectangle;
3. map that rectangle to tiles;
4. redraw only those tiles;
5. transfer changed regions to the display;
6. request a partial display refresh;
7. perform an occasional full refresh to reduce ghosting.

***

# 8. Input system

## 8.1 Physical keyboard

MicroBookkeeping will use a custom physical keyboard.

Initial key groups should include:

### Navigation

* Up
* Down
* Left
* Right
* Page Up
* Page Down
* Previous object
* Next object
* Select
* Back

### Editing

* Insert
* Delete
* Backspace
* Enter
* Space
* Undo
* Redo
* Copy
* Paste

### Bookkeeping-specific operations

* New cell
* New text object
* New table
* New diagram element
* Add connector
* Add annotation
* Search
* Open document
* Save or checkpoint
* Open command menu

## 8.2 Keyboard electrical design

The keyboard should use a matrix with optional per-key diodes.

```text
Rows ────────► interrupt-capable inputs
Columns ─────► controlled outputs
```

The keyboard should wake the processor through an interrupt. Matrix scanning should occur only after a key transition or while handling key repetition.

## 8.3 Input abstraction

The application should receive semantic events rather than raw GPIO states.

Examples:

```text
KeyPressed(Left)
KeyReleased(Left)
KeyRepeated(Backspace)
Command(NewCell)
Command(Search)
```

This permits the same application to receive input from:

* a normal USB keyboard on Raspberry Pi;
* GPIO buttons on Raspberry Pi;
* an Arduino keyboard matrix;
* the final custom keyboard.

***

# 9. Processing platform

## 9.1 Development platform progression

The processor platform will progress through four principal stages:

```text
Raspberry Pi
    ↓
Arduino-compatible MCU board
    ↓
Same MCU using native vendor tools
    ↓
Custom PCB with selected ultra-low-power MCU
```

## 9.2 Raspberry Pi role

The Raspberry Pi will be used to prove:

* e-paper communication;
* object rendering;
* keyboard behavior;
* the document model;
* storage design;
* viewport navigation;
* multilingual bitmap fonts;
* synchronization;
* test and diagnostic tooling.

The Raspberry Pi is not a candidate for the final low-power product.

## 9.3 Arduino-compatible stage

The Arduino stage will test MicroBookkeeping under genuine microcontroller constraints.

The `.ino` file will only perform platform initialization and call the portable application. Most implementation code will remain in conventional `.cpp` and `.hpp` files.

The Arduino-compatible board should provide:

* ARM Cortex-M or comparable MCU;
* at least 256 KiB SRAM for early development;
* hardware SPI;
* sufficient GPIO for the keyboard matrix;
* deep-sleep support;
* external-flash support;
* interrupt-capable pins;
* a development ecosystem that permits current measurement.

A classic 8-bit Arduino Uno is not recommended for this stage because its available RAM is too restrictive for practical development of the complete renderer, document model, font system, and storage cache.

## 9.4 Final MCU criteria

The final processor will be selected using measurements rather than only advertised active power.

Selection criteria:

* deep-sleep current;
* wake-up time;
* active energy per operation;
* internal RAM;
* internal program flash;
* QSPI or OctoSPI capability;
* DMA support;
* GPIO count;
* interrupt availability;
* operating-voltage range;
* package complexity;
* development-tool quality;
* long-term availability;
* external-memory support;
* ability to power-gate peripherals.

An STM32U0-class processor may be useful for a highly optimized tiled implementation. Current STM32U031 documentation lists Stop 2 consumption of 515 nA without RTC, 630 nA with RTC, and run-mode consumption of 52 µA/MHz under the documented conditions. Smaller devices in that family provide only 12 KiB SRAM, however, so memory requirements must be evaluated carefully. [\[st.com\]](https://www.st.com/content/ccc/resource/technical/document/datasheet/group3/95/76/d8/a9/90/0f/42/4d/DM01047904/files/DM01047904.pdf/jcr:content/translations/en.DM01047904.pdf), [\[st.com\]](https://www.st.com/en/microcontrollers-microprocessors/stm32u031r8.html)

An Ambiq Apollo4-class processor is another possible advanced candidate because it offers considerably more internal memory and manufacturer-specified execution efficiency as low as 5 µA/MHz. Its BGA packaging and greater hardware complexity may make it less appropriate for the first custom PCB. [\[ambiq.com\]](https://ambiq.com/product/apollo4/)

***

# 10. Storage architecture

## 10.1 Storage categories

MicroBookkeeping will separate storage by purpose.

### Program storage

Contains:

* firmware;
* built-in UI resources;
* recovery routines;
* core Latin font;
* basic symbols.

### User-document storage

Contains:

* documents;
* document indexes;
* relationships;
* metadata;
* snapshots;
* journal records.

### Optional font-pack storage

Contains:

* Greek glyphs;
* Cyrillic glyphs;
* Armenian glyphs;
* Georgian glyphs;
* Persian glyphs;
* mathematical symbols;
* user-installed glyph collections.

## 10.2 Recommended storage technologies

### QSPI NOR flash

Recommended for:

* document data;
* font packs;
* snapshots;
* indexes;
* imported resources.

Initial capacity target:

```text
32 MB to 128 MB
```

### FRAM

Optional FRAM may store:

* current document ID;
* current viewport;
* small journal entries;
* recovery markers;
* power-failure state;
* frequently changed metadata.

### microSD

microSD should be deferred until after the core power and storage architecture is stable.

Potential future uses:

* import and export;
* backup;
* desktop synchronization;
* large document archives.

It should not initially be the only document store because memory-card startup, filesystem recovery, and inconsistent low-power behavior would complicate the first implementation.

## 10.3 Transactional storage

Document editing must survive unexpected power loss.

Recommended process:

```text
1. Create an operation record.
2. Attach a sequence number and checksum.
3. Append it to the journal.
4. Verify the stored record.
5. Update the in-memory document state.
6. Periodically create a compact snapshot.
7. Mark journal records included in the snapshot.
8. Reclaim old storage blocks later.
```

The device should be tested by removing power during:

* journal writes;
* snapshot creation;
* index updates;
* document opening;
* object deletion;
* font-pack access.

***

# 11. Font and multilingual text strategy

## 11.1 General approach

MicroBookkeeping will use bitmap font packs rather than depending on segmented characters or performing expensive vector-font rasterization for every glyph.

A glyph record may contain:

```text
Glyph identifier
Unicode code point
Width
Height
Horizontal advance
Horizontal bearing
Vertical bearing
Compressed one-bit bitmap
```

## 11.2 Initial script milestones

Recommended implementation order:

1. Latin;
2. common punctuation and symbols;
3. Greek;
4. Cyrillic;
5. Armenian;
6. Georgian;
7. Persian display;
8. Persian editing and bidirectional behavior.

## 11.3 Persian requirements

Persian support requires more than glyph storage. It also requires:

* right-to-left layout;
* contextual shaping;
* joining behavior;
* combining marks;
* bidirectional text handling;
* correct number placement;
* appropriate cursor navigation;
* selection behavior across mixed-direction text.

An intermediate implementation may store both:

* logical Unicode text for interchange and editing;
* pre-shaped glyph runs for efficient embedded rendering.

The Desktop application may initially perform complex shaping when exporting documents to MicroBookkeeping.

***

# 12. Power architecture

## 12.1 Energy sources

MicroBookkeeping will use two energy sources:

1. a rechargeable battery as the primary and stabilizing source;
2. a solar panel as a secondary charging and battery-life-extension source.

The solar panel should initially be treated as an assistant to the battery rather than a guarantee of indefinite operation.

## 12.2 Power-management components

The system will require:

* protected rechargeable battery;
* compatible battery charger;
* energy-harvesting or solar power-management circuit;
* low-quiescent-current voltage regulator;
* display load switch;
* optional memory load switch;
* battery-voltage monitoring;
* solar-voltage monitoring;
* power-good output;
* reverse-current protection;
* appropriate decoupling;
* battery-temperature monitoring where required;
* subsystem test points.

The BQ25570 is one candidate for energy-harvesting experiments. It is intended for microwatt-to-milliwatt energy sources, supports programmable maximum-power-point tracking, and specifies a typical full operating quiescent current of 488 nA. Its output and peak-current limitations must be checked against the selected display and processor. [\[ti.com\]](https://www.ti.com/product/BQ25570), [\[ti.com\]](https://www.ti.com/lit/ds/symlink/bq25570.pdf?ts=1774369992447)

An evaluation board should be used before designing the charger onto the custom PCB. TI provides a BQ25570 evaluation-module guide containing the reference schematic, bill of materials, test results, and layout guidance. [\[ti.com\]](https://www.ti.com/lit/ug/sluuaa7a/sluuaa7a.pdf?ts=1775026230407)

## 12.3 Preliminary power targets

| Operating state                      | Preliminary design target |
| ------------------------------------ | ------------------------: |
| Transport or shutdown                |                Under 5 µW |
| Sleeping and ready for keyboard wake |               Under 20 µW |
| Key processing                       |               Brief burst |
| Text rendering                       |           5–30 mW briefly |
| Partial display refresh              |   Display-dependent burst |
| Full display refresh                 |   Display-dependent burst |
| Average interactive operation        |     Preferably under 1 mW |
| Static display and sleep             |                Tens of µW |

These are engineering targets, not guaranteed final specifications.

## 12.4 Energy accounting

Every important action should be measured as energy per operation:

```text
Energy per key
Energy per rendered glyph
Energy per changed tile
Energy per journal write
Energy per partial refresh
Energy per full refresh
Energy per document load
```

A faster processor may consume less total energy if it completes an operation quickly and returns to sleep.

***

# 13. Required components

## 13.1 Phase 1: Raspberry Pi prototype

### Required hardware

* Raspberry Pi with GPIO and SPI support;
* suitable power supply;
* microSD card for the Pi;
* existing Waveshare monochrome e-paper display;
* matching display driver board;
* display cable;
* breadboard;
* jumper wires;
* tactile switches or temporary keyboard;
* resistors;
* optional key-matrix diodes;
* USB keyboard for early development;
* digital multimeter;
* logic analyzer, recommended;
* oscilloscope, optional.

### Required software

* Linux;
* C++ compiler;
* CMake or another native build system;
* Git;
* unit-test framework;
* SPI and GPIO access library;
* display test utility;
* document-conversion tools;
* bitmap-font conversion tool;
* diagnostic logging tools.

## 13.2 Phase 2: Arduino-compatible MCU prototype

### Required hardware

* Arduino-compatible ARM Cortex-M development board;
* at least 256 KiB RAM recommended;
* hardware SPI;
* interrupt-capable GPIO;
* deep-sleep capability;
* Waveshare e-paper module;
* keyboard matrix;
* keyboard diodes;
* QSPI NOR flash module;
* optional FRAM module;
* regulated bench supply;
* current-measurement instrument;
* headers and test leads.

### Required software

* Arduino-compatible toolchain;
* standard C++ source files;
* board-specific low-power library;
* SPI driver;
* flash driver;
* automated test harness;
* image comparison or framebuffer verification utility.

## 13.3 Phase 3: Battery and solar prototype

### Required hardware

* protected rechargeable battery pack;
* chemistry-compatible charger;
* solar panel, initially approximately 1–3 W for experimentation;
* BQ25570 evaluation board or comparable harvesting board;
* low-quiescent-current regulator;
* load switches;
* bulk and decoupling capacitors;
* current-sense resistor;
* battery connector;
* solar connector;
* power-domain jumpers;
* temperature sensor;
* fuse or suitable protection component;
* power profiler with logging.

## 13.4 Phase 4: Native MCU prototype

### Required hardware

This phase may reuse the Arduino-compatible development board.

Additional items:

* MCU vendor’s debug probe;
* SWD or JTAG connector;
* appropriate native SDK;
* direct register or vendor HAL access;
* current-measurement jumper modifications;
* external flash;
* optional PSRAM or FRAM;
* display power-gating circuit;
* keyboard wake circuit.

## 13.5 Phase 5: Custom PCB

### Required PCB components

* selected MCU;
* program decoupling capacitors;
* crystal or oscillator, if required;
* QSPI NOR flash;
* optional FRAM;
* optional external RAM;
* e-paper connector;
* e-paper power switch;
* keyboard matrix;
* keyboard diodes;
* solar power-management IC;
* rechargeable-battery interface;
* low-quiescent-current regulator;
* voltage dividers or monitors;
* reverse-polarity protection;
* ESD protection;
* programming connector;
* reset control;
* factory test pads;
* battery connector;
* solar connector;
* power-domain test points;
* mounting holes;
* enclosure connectors;
* optional USB data interface.

### Mechanical components

* enclosure;
* keyboard plate;
* keycaps;
* display protection window;
* PCB supports;
* battery compartment;
* solar-panel mounting arrangement;
* screws and inserts;
* strain relief for internal cables;
* labels and safety markings.

***

# 14. Development phases

## Phase 0 — Requirements and desktop simulation

### Objective

Define the embedded product before connecting hardware.

### Activities

* define supported document objects;
* define the minimum editing commands;
* define display resolution;
* define keyboard commands;
* design the portable platform interfaces;
* build a one-bit desktop renderer;
* implement tile rendering;
* simulate limited RAM;
* simulate slow display refresh;
* design the storage format;
* create representative test documents.

### Deliverables

* requirements document;
* architecture document;
* initial `.microbook` format;
* desktop renderer;
* sample documents;
* memory-budget estimate;
* test plan.

### Exit criteria

* positioned cells and diagrams render correctly;
* the renderer can operate tile by tile;
* Linux-specific logic is isolated;
* representative documents can be opened;
* expected embedded-memory use has been estimated.

***

## Phase 1 — Raspberry Pi and e-paper proof of concept

### Objective

Display a real Bookkeeping document on the physical e-paper panel.

### Activities

* connect the Waveshare display through SPI;
* implement or integrate the display driver;
* render a static document;
* implement full refresh;
* implement partial refresh;
* add viewport movement;
* add a USB or GPIO keyboard;
* measure rendering and display latency;
* investigate ghosting.

### Deliverables

* working Raspberry Pi executable;
* e-paper display driver;
* viewport implementation;
* rendering-performance report;
* display-refresh report.

### Exit criteria

* a real document is visible on e-paper;
* text, cells, and diagrams render correctly;
* viewport movement is usable;
* dirty regions are identified correctly;
* partial updates work where supported.

***

## Phase 2 — Raspberry Pi editing prototype

### Objective

Create a complete keyboard-oriented interaction prototype.

### Activities

* implement object selection;
* implement text insertion and deletion;
* implement cell creation;
* implement object movement;
* implement connectors;
* implement search;
* implement undo and redo;
* implement journaling;
* test sudden power loss;
* record performance metrics.

### Deliverables

* interactive editor;
* input mapping;
* journal implementation;
* recovery tool;
* usability findings;
* representative operation traces.

### Exit criteria

* documents can be edited without a mouse;
* interrupted writes can be recovered;
* only affected display regions are refreshed;
* no core application module depends directly on Pi GPIO.

***

## Phase 3 — Arduino-compatible MCU port

### Objective

Run MicroBookkeeping without Linux.

### Activities

* select a sufficiently capable development board;
* port platform abstractions;
* keep the `.ino` entry point minimal;
* port the e-paper driver;
* connect external flash;
* connect the keyboard matrix;
* measure RAM and stack use;
* replace unbounded allocations;
* implement keyboard wake;
* implement sleep between events.

### Deliverables

* MCU firmware;
* memory-use report;
* stack high-water measurement;
* keyboard matrix;
* external-storage driver;
* latency measurements.

### Exit criteria

* the system opens and edits a representative document;
* memory use remains within a defined limit;
* keyboard wake works;
* no continuous input polling is required;
* flash recovery works after forced power removal;
* interactive latency is acceptable.

***

## Phase 4 — Power-optimized MCU firmware

### Objective

Prove that the MCU can meet the power budget.

### Activities

* isolate framework overhead;
* enter the MCU’s native deep-sleep modes;
* disable unused clocks and peripherals;
* remove development-board LEDs;
* disconnect USB-to-serial circuitry if necessary;
* power-gate the display;
* power-gate optional storage;
* measure every operating state;
* calculate energy per user operation.

### Deliverables

* measured current-state table;
* energy-per-operation report;
* improved firmware;
* leakage investigation;
* final MCU requirements.

### Exit criteria

* deep-sleep current meets the prototype target;
* all peripherals enter known low-power states;
* the processor wakes reliably from keyboard input;
* partial display updates remain usable;
* energy consumption is understood well enough to size the battery.

***

## Phase 5 — Battery-powered prototype

### Objective

Operate independently from USB and bench power.

### Activities

* select battery chemistry and capacity;
* add compatible protection and charging;
* add battery monitoring;
* detect low-battery conditions;
* implement safe shutdown;
* implement transport mode;
* test battery runtime;
* test operation at expected temperatures.

### Deliverables

* battery-powered prototype;
* runtime report;
* low-battery behavior;
* battery-safety design notes;
* charging and shutdown tests.

### Exit criteria

* device starts and runs safely from the battery;
* deep discharge is prevented;
* firmware handles power loss safely;
* measured runtime is consistent with calculated runtime.

***

## Phase 6 — Solar-assisted prototype

### Objective

Use solar energy to extend battery life.

### Activities

* measure panel output under realistic lighting;
* evaluate an energy-harvesting board;
* configure maximum-power-point behavior;
* record daily harvested energy;
* test battery charging;
* test low-light behavior;
* test insufficient-energy behavior;
* establish the required panel size.

### Deliverables

* solar-assisted prototype;
* indoor and outdoor energy measurements;
* daily energy balance;
* selected charger architecture;
* selected panel specification.

### Exit criteria

* solar charging is stable;
* the battery is protected from overcharge;
* the system behaves safely under insufficient light;
* measured harvested energy supports the intended use case.

***

## Phase 7 — Native MCU software

### Objective

Remove unnecessary Arduino framework dependencies while retaining the same hardware.

### Activities

* migrate to the MCU vendor’s SDK;
* reuse the portable C++ core unchanged;
* replace board-level Arduino drivers;
* configure clocks explicitly;
* configure sleep and wake explicitly;
* configure DMA where beneficial;
* compare the native version against the Arduino version.

### Deliverables

* native MCU firmware;
* framework comparison;
* reduced memory use where possible;
* improved power behavior;
* final hardware interface specification.

### Exit criteria

* functional behavior matches the Arduino prototype;
* power and memory behavior are understood;
* all required peripherals have stable native drivers;
* the firmware is suitable for a custom board.

***

## Phase 8 — Custom PCB prototype

### Objective

Integrate the proven subsystems onto a dedicated board.

### Activities

* produce the schematic;
* perform design review;
* lay out the PCB;
* include power-domain test points;
* manufacture a small prototype batch;
* assemble and inspect boards;
* perform bring-up;
* validate power supplies;
* validate MCU programming;
* validate display, storage, keyboard, and charger;
* compare measured behavior with the development-board prototype.

### Deliverables

* schematic;
* PCB layout;
* fabrication files;
* assembly files;
* bill of materials;
* bring-up procedure;
* hardware-revision report.

### Exit criteria

* custom board boots reliably;
* all peripherals function;
* power targets remain achievable;
* no unsafe charging or thermal behavior is observed;
* hardware defects are documented for the next revision.

***

## Phase 9 — Integrated product prototype

### Objective

Create a complete portable unit.

### Activities

* design the enclosure;
* integrate the keyboard;
* protect the display;
* mount the battery;
* mount or connect the solar panel;
* test mechanical durability;
* test thermal behavior;
* conduct extended runtime testing;
* test document compatibility;
* perform usability testing.

### Deliverables

* enclosed prototype;
* user guide;
* maintenance guide;
* final keyboard layout;
* extended test report;
* product-revision recommendations.

### Exit criteria

* the prototype can be used for normal Bookkeeping work;
* runtime and charging meet project goals;
* data survives expected failure conditions;
* the device can be transported safely;
* major usability problems are resolved.

***

# 15. Software repository structure

```text
microbookkeeping/
├── CMakeLists.txt
├── README.md
├── docs/
│   ├── architecture.md
│   ├── document-format.md
│   ├── power-budget.md
│   ├── keyboard-layout.md
│   └── testing.md
├── core/
│   ├── document/
│   ├── editor/
│   ├── layout/
│   ├── renderer/
│   ├── fonts/
│   ├── storage/
│   └── synchronization/
├── platform/
│   ├── desktop_simulator/
│   ├── raspberry_pi/
│   ├── arduino/
│   └── native_mcu/
├── drivers/
│   ├── display/
│   ├── flash/
│   ├── fram/
│   ├── keyboard/
│   └── power/
├── tools/
│   ├── font_converter/
│   ├── document_converter/
│   └── recovery/
├── tests/
│   ├── unit/
│   ├── rendering/
│   ├── storage/
│   ├── fuzz/
│   └── power_failure/
└── hardware/
    ├── prototypes/
    ├── schematic/
    ├── pcb/
    ├── bom/
    └── enclosure/
```

***

# 16. Testing strategy

## 16.1 Functional testing

Test:

* object creation;
* object deletion;
* text editing;
* navigation;
* table editing;
* connector editing;
* search;
* undo and redo;
* document loading;
* document saving;
* font-pack loading;
* synchronization.

## 16.2 Rendering testing

Maintain reference images for:

* text;
* tables;
* diagrams;
* overlapping objects;
* viewport boundaries;
* clipping;
* Greek;
* Cyrillic;
* Armenian;
* Georgian;
* Persian;
* mixed-direction text.

## 16.3 Storage testing

Test:

* erased flash;
* full flash;
* corrupted records;
* invalid checksums;
* interrupted writes;
* interrupted snapshot creation;
* repeated edits;
* document recovery;
* storage wear behavior.

## 16.4 Power testing

Measure:

* shutdown current;
* deep-sleep current;
* keyboard wake;
* key processing;
* glyph rendering;
* partial refresh;
* full refresh;
* flash read;
* flash write;
* FRAM write;
* startup;
* low-battery shutdown;
* solar charging.

## 16.5 Hardware testing

Test:

* reverse connections where protection is intended;
* ESD resilience;
* connector reliability;
* keyboard durability;
* display cable retention;
* battery temperature;
* charging temperature;
* regulator stability;
* display peak current;
* solar-input changes;
* long-term sleep.

***

# 17. Principal project risks

| Risk                                       | Impact                             | Mitigation                                                                              |
| ------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------- |
| E-paper refresh is too slow                | Poor editing experience            | Use partial refresh, dirty tiles, delayed batching and a cursor optimized for the panel |
| E-paper ghosting                           | Reduced readability                | Periodic full refresh and panel-specific refresh policy                                 |
| MCU lacks sufficient RAM                   | Rework or external memory required | Measure early; use tile rendering and bounded caches                                    |
| Development board consumes excessive power | Misleading power result            | Measure MCU and subsystem rails separately                                              |
| Solar panel produces little indoor energy  | Battery does most of the work      | Treat solar as assistance and measure realistic locations                               |
| Storage corruption after power loss        | Loss of user data                  | Append-only journal, checksums, snapshots and forced-failure testing                    |
| Persian shaping is too complex             | Incomplete script support          | Stage support and optionally pre-shape on Desktop                                       |
| Framework prevents deep sleep              | Excessive current                  | Test native MCU SDK on the same board                                                   |
| Keyboard matrix consumes continuous energy | Reduced battery life               | Interrupt-driven wake and scan only on events                                           |
| Custom PCB introduces leakage              | Missed power goals                 | Add test points and independently switchable power domains                              |
| Battery or charger is unsafe               | Damage or injury                   | Use protected cells and a chemistry-compatible charging design                          |
| Component becomes unavailable              | Manufacturing delay                | Prefer established parts and keep alternatives documented                               |

***

# 18. Initial success criteria

MicroBookkeeping Version 1 will be considered technically successful when it can:

1. open a representative Bookkeeping document;
2. display arbitrary positioned text, cells, and diagrams;
3. navigate entirely through a physical keyboard;
4. edit and save text;
5. recover after power is removed during a write;
6. retain the visible page while the processor sleeps;
7. wake from keyboard input without continuous scanning;
8. operate from a rechargeable battery;
9. accept solar-assisted charging;
10. exchange documents with Bookkeeping Desktop;
11. achieve a measured low-power state consistent with long battery life;
12. operate without Linux, cloud services, or an illuminated display.

***

# 19. Immediate next actions

## Step 1 — Inventory existing hardware

Record:

* Raspberry Pi model;
* exact Waveshare display model;
* resolution;
* display controller;
* supported refresh modes;
* available buttons and switches;
* available measurement equipment.

## Step 2 — Establish the repository

Create:

```text
core/
platform/raspberry_pi/
drivers/display/
tests/
docs/
```

## Step 3 — Define the first screen

Use a fixed one-bit canvas matching the physical display.

The first demonstration document should include:

* a title;
* three positioned cells;
* one non-rectangular arrangement;
* one text note;
* one line or connector;
* Greek text;
* Cyrillic text;
* a visible selection cursor.

## Step 4 — Implement static rendering

Do not begin with full document editing. First prove:

```text
Bookkeeping document
    ↓
Embedded document representation
    ↓
Tile renderer
    ↓
One-bit bitmap regions
    ↓
Waveshare display
```

## Step 5 — Add measurement from the beginning

Record:

* render time;
* display-transfer time;
* refresh time;
* number of dirty tiles;
* bytes read;
* bytes written;
* maximum working memory.

## Step 6 — Add keyboard-only navigation

Implement:

* selection;
* movement;
* viewport scrolling;
* object switching;
* one simple edit command.

## Step 7 — Build the storage journal

Test recovery before adding solar charging or designing a PCB.

***

# 20. Final engineering direction

The recommended evolution is:

```text
Desktop one-bit simulation
        ↓
Raspberry Pi with real Waveshare e-paper
        ↓
Raspberry Pi with physical keyboard and editing
        ↓
Arduino-compatible low-power MCU board
        ↓
Battery-powered and measured MCU prototype
        ↓
Solar-assisted prototype
        ↓
Native MCU firmware without Arduino dependency
        ↓
Custom PCB
        ↓
Integrated MicroBookkeeping product prototype
```

This strategy minimizes risk by separating the major engineering problems:

* document-model design;
* rendering;
* interaction;
* multilingual text;
* storage reliability;
* MCU resource constraints;
* low-power behavior;
* solar charging;
* custom hardware.

The project should not begin by selecting the smallest MCU or manufacturing a specialized display. It should begin by proving that a real Bookkeeping document can be rendered and edited efficiently on the existing Waveshare display. Hardware should then be reduced and optimized according to measured memory, timing, and energy requirements.
