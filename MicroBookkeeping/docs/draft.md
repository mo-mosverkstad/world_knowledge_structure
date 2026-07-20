I am considering to build a hardware variant of hardware of my Bookkeeping application which is basically an editor software for cheat sheets written both as Webapp and in C++ desktop app (re-compile to support your platform and CPU architecture). Bookkeeping has a number of tables and diagrams (cells not in rectangular table, but in arbitrary positions). Since the UI consists of a large immovable table with some sidebar containing some things, I am considering building a hardware variant of it, due to low-power consideration. It is accompanied with 2-way energy source: one battery (main) and one solar panel. The finalized product has a lightless small 14-segment display (128*96 characters large) for characters, a custom keyboard, and so on. One problem is to render Greek, Cyrillic, Armenian, Georgian and Persian letters, which is a headache, but I will find other ways outside it. No idea if these kind of large contigous 14-segment display arrays exist or not? 

I call this project as MicroBookkeeping, apart from Bookkeeping (Standard desktop version in C++), BookkeepingWebapp. One problem is that I have to be very caution with using microcontrollers!!! They are notorious of eating energy and do things I don't like it to do. I consider use a small microcontroller that consume tens milliwatts since a solar cell does not cover very much energy. And also having a battery to back up in case there is no light or too little light. What do materials do I need?

---

Purpose: Since bookkeeping app is commonly used, it is therefore necessary to make it simple and high-performant using a custom specialized ultra-low-power hardware instead of relying on general-purpose desktop computer or mobile phones that is built for general application.

---

A good way to formalize MicroBookkeeping is to treat it as a separate product with its own engineering goals, instead of merely "Bookkeeping running on weaker hardware". The hardware version should have a narrower purpose: a persistent, ultra-low-power knowledge and bookkeeping terminal.

Here is a possible project specification.

MicroBookkeeping — Project Definition
1. Project identity

Name: MicroBookkeeping
Parent project: Bookkeeping ecosystem

Related software:

Bookkeeping Desktop — C++ native application for general-purpose computers
Bookkeeping Webapp — browser-based version
MicroBookkeeping — dedicated low-power hardware terminal
2. Purpose

MicroBookkeeping is a standalone electronic device designed to display, edit, and maintain structured bookkeeping data using minimal energy.

The device prioritizes:

long battery life
solar-assisted operation
instant readability
offline operation
durable storage
custom input hardware
simple, deterministic behavior

It is not intended to replace the desktop application. Instead, it is a portable, always-available interface.

3. Core concept
Data model

MicroBookkeeping uses the same conceptual model as Bookkeeping:

tables
cells
diagrams
relationships
notes
annotations

However, the rendering engine is adapted for:

monochrome display
limited memory
slow refresh
low CPU usage

The fundamental unit is not a spreadsheet cell but a positioned object.

Example:

Document
 |
 +-- Object
      |
      +-- Text block
      +-- Diagram element
      +-- Cell
      +-- Connector
      +-- Annotation


This matches your existing idea of cells not necessarily belonging to rectangular tables.

4. Hardware specification (draft)
Display

Initial prototype:

Waveshare e-ink display
monochrome
SPI interface

Possible future:

custom memory LCD
custom segmented LCD
larger e-paper panel

Display requirements:

no backlight
sunlight readable
retain image without power
partial refresh preferred
Processing unit

Requirements:

ultra-low power
deterministic operation
no unnecessary background tasks

Possible MCU families:

STM32L
MSP430
Ambiq Apollo

Target:

State	Power target
Sleep	<100 µW
Idle	<1 mW
Editing	<50 mW
Display refresh	temporary peak
5. Memory architecture

Separate memories by purpose.

Program storage

Contains:

firmware
rendering engine
fonts
UI code

Example:

Flash
 |
 +-- Firmware
 +-- Unicode font data
 +-- UI resources

User storage

Contains:

Bookkeeping documents
settings
history

Example:

Storage
 |
 +-- Documents
 |
 +-- Metadata
 |
 +-- Index
 |
 +-- Recovery data


Possible technologies:

SPI NOR flash
FRAM for frequently changed data
6. Input system

Custom keyboard.

Possible architecture:

Keyboard matrix

Rows
 |
 MCU
 |
Columns


Features:

physical keys
low power scanning
wake-on-keypress

Possible keys:

Navigation
Up
Down
Left
Right
Select
Back
Editing
Insert
Delete
Copy
Paste
Undo
Bookkeeping-specific
New cell
Link object
Add note
Search
7. Software architecture

Avoid a full operating system.

Recommended:

MicroBookkeeping Firmware

        |
        |
 ------------------------
 |          |            |
Storage   Renderer    Input
 |          |            |
Files    E-ink       Keyboard

Rendering engine

Separate from Bookkeeping Desktop.

Shared:

document format
data structures
serialization

Different:

renderer
user interface
input handling

Example:

Bookkeeping Core Library
          |
 -----------------
 |               |
Desktop       Micro
Renderer      Renderer

8. Document format

Define a hardware-neutral format.

Example:

.microbook

Header
 |
Metadata
 |
Objects
 |
Relationships
 |
Assets


Objects:

Object ID
Type
Position
Content
Style


Example:

Object:
 ID: 42
 Type: Text
 X: 300
 Y: 120
 Content:
   "Revenue"

9. Font strategy

Do not use segment-based characters.

Use bitmap fonts.

Pipeline:

Unicode
 |
Glyph lookup
 |
Bitmap
 |
E-ink pixels


Memory-efficient approach:

Store only required scripts.

Example:

Firmware fonts:

Latin
Greek
Cyrillic
Armenian
Georgian
Persian


Later:

Downloadable font packs.

10. Power system
Energy sources

Primary:

rechargeable battery

Secondary:

solar panel

Architecture:

Solar
 |
MPPT charger
 |
Battery
 |
Voltage regulator
 |
MCU + Display

Power philosophy

The device should spend most of its life asleep.

Example:

99.9% sleep

0.1%:
    wake
    process input
    refresh display
    return to sleep

11. Prototype milestones
Prototype 0 — Software simulation

Run MicroBookkeeping UI on desktop.

Goal:

prove document format
prove renderer
Prototype 1 — Existing hardware

Using your Waveshare display.

Hardware:

ESP32 or STM32 development board
Waveshare e-paper
simple buttons

Goal:

render Bookkeeping documents
Prototype 2 — Custom PCB

Add:

selected MCU
flash
FRAM
keyboard connector
battery circuit
solar charging
Prototype 3 — Product prototype

Add:

enclosure
custom keyboard
optimized power
manufacturing considerations
12. Design principles

MicroBookkeeping should follow these rules:

No unnecessary computation
No background services
No forced cloud dependency
Data belongs to the user
The display should consume almost no energy
The device should remain useful after years of storage

A concise project statement could be:

MicroBookkeeping is a solar-assisted, ultra-low-power electronic bookkeeping terminal that provides a persistent physical interface for structured information. It shares a common document model with Bookkeeping while using a dedicated rendering engine optimized for reflective displays and constrained hardware.

Your Waveshare e-ink display is actually a very good first prototype platform because it lets you validate the software architecture and interaction model before committing to custom display hardware. The first engineering goal should probably be: render a real Bookkeeping document on the Waveshare device with a tiny embedded renderer.