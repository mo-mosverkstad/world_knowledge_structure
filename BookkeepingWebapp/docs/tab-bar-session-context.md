# TabBar — session handoff context

Read this to resume work on `src/views/tab-bar/` without replaying the
conversation that produced it. Written at the end of the session that added two
features: **externally modifiable active tab** and **overflow scrolling with
reveal-on-activate**.

Canonical documentation lives in `src/views/tab-bar/README.md`. This file is the
*session* record: decisions, rejected alternatives, my mistakes and their
corrections, and the state of the working tree. Do not duplicate the README here —
read both.

---

## 1. Where things stand

| | |
| --- | --- |
| Component | `src/views/tab-bar/` (11 files incl. README) |
| Tests | `tests/views/tab-bar.test.tsx` (17), `tests/views/tab-bar-scroll.test.tsx` (22) |
| Suite total | **215 passing** (176 pre-existing parser/math tests + 39 tab-bar) |
| `tsc --noEmit` | Clean **except** one pre-existing unrelated error: `src/syntax-plugins/math/index.ts(1,1) TS6133 'MathNode' declared but never read`. Not mine, not fixed. |
| `vite build` | Succeeds |
| Both features | Committed. `e7aa830` = overflow/scroll, `9452826` + `e4e64a6` = active-tab port |
| Uncommitted | `src/views/tab-bar/README.md` and `tests/views/tab-bar-scroll.test.tsx` — the reorder clarification and its 2 tests, staged but not committed |

Never verified visually. All confirmation is via jsdom tests, `tsc` and `vite
build`. `npm run dev` was never run. jsdom has no layout engine, so the scroll
tests fake element geometry (`getBoundingClientRect`, `clientWidth`,
`scrollWidth`, `scrollLeft`) around the real component DOM — arithmetic and
trigger decisions are genuinely exercised, real browser layout is not.

---

## 2. Feature 1 — externally modifiable active tab

### The user's goal, in their words

Expose the active tab so it can be modified from outside the component, because
the component will be integrated into a larger system (an editor). Undo/redo was
offered as **one example use case**, not the requirement.

### What it is

A standard **controlled component** — the `<input value onChange>` pattern.

```
   <input>                       <TabBar>
   value={text}                  activeTabId={workspace.activeKey}
   onChange={setText}            onActiveTabSelect={setActiveKey}
```

`activeTabId` is the READ half, `onActiveTabSelect` the WRITE half. Supply both
and the host owns the active tab, so anything that can write the host's state can
move the tabs. No component-specific API involved:

```tsx
setWorkspace((p) => ({ ...p, activeKey: "d3" }));   // tab bar follows
```

### Design decisions

- **Two props, not a bundled `{ activeId, select }` object.** Discussed as
  "option A" (bundled) vs "option B" (split). Chose B: standard idiom, and the
  bundling only pays off when several components share one selection, which is
  not the case here.
- **`activeTabId` widened to `string | null`.** `undefined` = "you own it,
  TabBar"; `null` = "I own it, nothing selected". Previously inexpressible.
- **`onActiveTabSelect` fires in BOTH modes**, so a host can observe selection
  intent without taking ownership.
- **`reason: "user-select" | "fallback"`** distinguishes a user click from "your
  active tab was deleted, here is a replacement".
- **One internal writer.** `select()` (user) and `reconcile()` (vanished tab) both
  funnel through a private `requestChange(id, reason)` in `useActiveTab`, which
  resolves ownership once.
- **`index` is derived and read-only.** Reported via `onActiveTabChange`, computed
  free in the existing single traversal. Never writable — an index shifts under
  close and reorder, so `id` is the only stable address.

### `onActiveTabSelect` vs `onActiveTabChange`

The user asked about this explicitly; it is the easiest thing to get wrong.

| | `onActiveTabSelect` | `onActiveTabChange` |
| --- | --- | --- |
| Timing | before — a request | after — a receipt |
| Your job | **write state** | **observe only** |
| Can affect outcome? | yes, ignore it and nothing moves | no |

Three behaviours I verified empirically with throwaway probes (deleted):

- **External change fires only `Change`** (`Select` 0 calls). Nobody needs to
  request a change that already happened. So `Change` sees every change regardless
  of origin — the right place for logging.
- **Clicking the already-active tab fires `Select` but not `Change`** (1 vs 0).
  `Select` is per-click; `Change` is deduplicated on value.
- **Refusing a request means `Change` never fires** (1 `Select`, 0 `Change`).

### Three bugs fixed

1. `null` was not expressible — a host wanting "nothing active" passed `undefined`,
   silently lost control, and had stale internal state resurrected.
2. Controlled mode was never told its active tab died — `reconcile` early-returned
   when controlled, discarding the `activeExists` fact the render pass had already
   computed.
3. `onTabClick` was doing double duty — documented as a free-form behavior hook,
   but in controlled mode it was the only channel for selection intent.

### Rejected, with reasons

- **Imperative ref handle** (`ref.current.setActive(id)`) — refs don't subscribe,
  so the parent must mirror the value back out, reintroducing two copies of the
  same fact. Also `ref.current` is `null` on first render, so you can't state the
  initial active tab declaratively.
- **External-store port object / `useSyncExternalStore`** — any store wires up
  inline: `activeTabId={store.activeTab}` / `onActiveTabSelect={store.setActiveTab}`.
- **Separate veto callback** — refusing is already just not acting on the request.
- **Ports/layers/funnels terminology** — my invention, and it actively confused
  the user. See §5.

### Undo/redo guidance (the user's example use case)

Because `activeKey` lives inside `workspace` alongside `documents`, snapshotting
`workspace` captures selection too, and undo is `setWorkspace(previousSnapshot)`.
TabBar never learns an undo happened. Two traps: don't record `"fallback"`
selections as their own undo step (closing a tab fires `onTabClose` *and* a
fallback select — one user action should be one undo entry), and snapshot the
whole `workspace`, not just `documents`. Whether selection belongs in undo history
is a product decision, not technical.

---

## 3. Feature 2 — overflow, scrolling, reveal

### The user's requirements, in their words

Max width in pixels **or** percentage. Stack as many tabs as you like; on overflow
scroll with a scrollbar. When a tab becomes active and isn't visible, scroll it
into view — *"the hardest part of this feature"*. Then two constraints given
after my first sketch:

1. **The hover-scrollbar CSS is deliberate.** "Whenever I hover out, I don't want
   the pesky scrollbar to persist while not interfering with the tab bar." I had
   called it a bug; I was wrong. It stays.
2. **No coupling.** Auto-scroll "should not be triggered by other functionality,
   but it is something being automatically done when setting the active tab
   externally... the setter function should not know that the tab must be actively
   scrolled into view."

And on animation: **instant**, because smooth "would feel like my program is
lagging" — but *programmable*, since "it's a generic component and it can be used
in any circumstances".

### The decoupling mechanism

`useRevealActiveTab` is **observed, never called**:

```
   coupled                        decoupled (what was built)
   select(id) {                   useLayoutEffect(() => {
       setState(id);                  reveal();
       reveal();  ← setter        }, [activeId]);
   }             knows                     ▲
                                           └─ nobody knows this exists
```

Both behave the same for a click. Only the observing form also fires when the host
changes the active tab from its own state, because there is no call site to attach
a `reveal()` to.

### One trigger, on purpose

The user's coupling objection killed three of the four triggers in my first
sketch:

| dep | kept? | why |
| --- | --- | --- |
| `activeId` | YES | the one thing the feature is about |
| `activeIndex` | no | that's "the active tab moved due to a reorder" — a different concern, and what made the hook know about reordering |
| `isDragging` | no | only needed *because* of `activeIndex`; dropping that removed the `useDragReorder` coupling entirely |
| `ResizeObserver` | no | "keep visible forever" ≠ "reveal when it becomes active" |

Result: `useActiveTab` touches no DOM, `useRevealActiveTab` holds no state,
neither knows `useDragReorder` exists.

`behavior` and `margin` are held in a **ref**, not dependencies — they are
*settings*, not *triggers*. Changing the margin must not cause a scroll.

### Implementation notes worth remembering

- **`useLayoutEffect`, not `useEffect`** — runs after DOM commit but before paint,
  so the correction lands in the same frame. With `useEffect` you'd see one
  painted frame at the old offset then a snap, most visible on first mount.
- **`container.scrollTo({left})`, not `scrollIntoView()`** — the latter walks up
  and scrolls *every* scrollable ancestor, so selecting a tab could jump the whole
  page.
- **`getBoundingClientRect`, not `offsetLeft`** — `offsetLeft` is relative to the
  nearest *positioned* ancestor and breaks silently depending on `position`. Rect
  deltas already account for current scroll; subtracting `clientLeft` removes the
  border so comparison against `clientWidth` is exact.
- **Case C (already visible → return) is the most important line** — makes the
  operation minimal and idempotent, so it can run on every active-tab change
  without feeling twitchy.
- **Result is clamped** to `[0, scrollWidth - clientWidth]` so a margin near
  either end can't overscroll. Browsers clamp too, but then code and DOM disagree
  and tests lie.
- **Finding the active tab:** `container.querySelector('[role="tab"][aria-selected="true"]')`,
  reading an attribute `Tab` already sets for a11y. This is why `Tab.tsx` needed
  no ref plumbing and stays untouched.

### CSS: kept the user's design, fixed two defects inside it

Kept `overflow: hidden` at rest with hover-reveal. Fixed:

- **`:focus` → `:focus-within`.** The container has `role="tablist"` but no
  `tabIndex`, so `:focus` could never match — keyboard users got no scrollbar at
  all. Tabs have `tabIndex={0}`, so `:focus-within` works.
- **`scrollbar-gutter: stable` + `scrollbar-width: thin`.** A ~15px bar appearing
  into the fixed `27px` height made every `height: 100%` tab visibly squash on
  hover. Reserving the gutter makes appear/disappear reflow-free.
- **`.tab { flex: 0 0 auto }`** — without it, 17 tabs compress to fit instead of
  overflowing.

### The reorder question (last thing discussed)

The user observed: *"when I reorder, it still behaves as expected"* — contradicting
my claim that reorder wouldn't re-reveal. Probed it; both statements are true:

- **Why it looks right:** `scrollLeft` belongs to the *container*, not any tab, so
  a reorder doesn't touch it. The viewport stays put and tabs re-lay-out
  underneath. Measured: zero `scrollTo` calls, `scrollLeft` unchanged, active tab
  still visible. It holds because displacement is one slot at most, and the
  dragged tab is usually already the active one (grabbing selects it, so the
  reveal fired on that click).
- **Where it breaks:** active tab flush against the viewport edge, then a reorder
  pushing it outward. Measured: active tab spans **342..442 in a 350px viewport**,
  92px clipped, no reveal fires.
- **Verdict:** left as-is and documented. `}, [activeId, activeIndex]);` would
  close it, but re-asserts scroll on mutations the user didn't initiate and needs
  an `isDragging` guard, reintroducing the coupling. Nothing is broken when it
  happens; the next click re-reveals.

Both behaviours are now locked in as tests so they can't silently drift.

---

## 4. Demo (`src/main.tsx`, `DataDrivenTabBarDemo`)

- 17 tabs by default (`initialDocuments()`), guaranteeing overflow on a normal
  display. Verified by render probe: 17 tabs, 16 close buttons ("Home" is
  `locked: true` → pinned), `max-width: 100%` applied.
- Random tab generation from a word pool with a monotonic `nextDocId` counter.
- Buttons: `◀ previous`, `next ▶`, `clear selection`, `+ add & activate`,
  `+ add (stay put)`, `+ add 5`, `reset`.
- `+ add & activate` appends far off-screen and reveals it purely by setting
  `activeKey` — the decoupling demo.
- Converted from the old mirroring pattern (`onActiveTabChange` → `setWorkspace`)
  to true controlled mode.

---

## 5. Working style — read this before continuing

The user is a strong engineer focused on **architecture, cohesion and coupling**.
They will push back, and they were right every time they did. Specifics:

- **I over-engineered the first three answers** of feature 1 — invented
  terminology ("ports", "layers", "funnels", "the single writer"), proposed a
  three-layer design with an external-store port, a ref handle and reason-tagged
  change objects. The user said *"I still no understand the apply of this. I have
  no idea what kind of architecture this is"*. The fix was to drop all of it and
  say "it's a controlled component, like `<input>`". **Lead with the standard name
  for a standard pattern.**
- **I built the design around their example** (undo/redo) instead of their
  requirement (external modifiability). They corrected me: *"I lift up undo as an
  example."*
- **I called their deliberate CSS a bug.** Ask before overriding an apparent
  oddity.
- **Diagram requests escalated**: prose → ASCII architecture → class diagram.
  They ask for diagrams when a design isn't landing. Honour the specific format
  requested.
- **Verify, don't assert.** Several of my confident claims were wrong: that
  `isControlled` needed to become an explicit option (it didn't — `null !==
  undefined`); that split props couldn't close the dangling-id hole (they could);
  that reorder would break the reveal (it usually doesn't). Probing with throwaway
  tests caught all three. **Write a probe, print the numbers, delete the probe.**
- **My tests were once too weak.** The first "don't fight the user" test passed
  even when I sabotaged the hook to run every render, because the active tab
  happened to be visible so Case C masked it. Rewrote it to scroll away first,
  then confirmed it fails against the sabotage. **Always sabotage the
  implementation to prove a test bites.**

### Repo conventions

- CRLF line endings in `src/main.tsx`, `Tab.css` and others. Multi-line
  `str_replace` anchors fail silently; use narrow single-line anchors or a Python
  edit preserving `\r\n`.
- `.prettierrc` is `{ "tabWidth": 4 }`, but the repo is **not** prettier-clean —
  `Tab.tsx`, `Tab.css`, `Tabs.css` were already flagged before any of my changes.
  Formatting was left alone to avoid unrelated diff noise.
- Test env: vitest with `test.environment: "node"` in `vite.config.ts`; DOM suites
  opt in per-file via `// @vitest-environment jsdom` so parser tests stay fast.
- Added as pinned dev deps for this work: `jsdom@27.0.0`,
  `@testing-library/react@16.3.0`.
- Commit message style: `BookkeepingWebapp: Phase 4 - <description>`.

---

## 6. Possible next steps

Not requested, not started, in rough order of likely value:

- **Keyboard navigation** — arrow keys to move between tabs, Home/End to jump.
  `Tab.tsx` already handles Enter/Space. Would exercise the reveal nicely.
- **`activeIndex` as a reveal trigger** — closes the documented reorder edge case;
  needs an `isDragging` guard and accepts the coupling.
- **Edge auto-scroll during drag** — dragging toward the container edge should
  scroll the strip. Belongs to `useDragReorder`, which the README deliberately
  scopes as *not* a general DnD framework.
- **`ResizeObserver` on content** — handles a tab before the active one growing
  wider (dirty marker, late font).
- **RTL support** — `scrollLeft` semantics differ; rect-delta math should mostly
  survive but is unverified.
- **Visual pass** — `npm run dev` has never been run against these changes.
