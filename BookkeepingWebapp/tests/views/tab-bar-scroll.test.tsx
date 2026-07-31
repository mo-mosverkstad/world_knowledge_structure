// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TabBar, type TabDescriptor } from "../../src/views/tab-bar";
import { revealHorizontally } from "../../src/views/tab-bar/useRevealActiveTab";

afterEach(cleanup);

/**
 * jsdom has no layout engine: every rect is zero and `clientWidth` is 0. These
 * helpers fake a horizontal layout so the reveal arithmetic can be exercised.
 * Tab widths and positions are therefore explicit, not measured.
 */
const TAB_W = 100;
const VIEW_W = 350; // fits 3.5 tabs

/** Give `el` a fake horizontal geometry. */
function fakeBox(
    el: HTMLElement,
    opts: { left: number; width: number; clientWidth?: number },
) {
    el.getBoundingClientRect = () =>
        ({
            left: opts.left,
            right: opts.left + opts.width,
            width: opts.width,
            top: 0,
            bottom: 27,
            height: 27,
            x: opts.left,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    if (opts.clientWidth !== undefined) {
        Object.defineProperty(el, "clientWidth", {
            value: opts.clientWidth,
            configurable: true,
        });
    }
}

/**
 * Build a container whose rect reflects its own `scrollLeft`, mimicking a real
 * scroll viewport: scrolling right moves children's rects left.
 */
function makeStrip(tabCount: number, scrollLeft = 0) {
    const container = document.createElement("div");
    const tabs: HTMLElement[] = [];

    let current = scrollLeft;
    Object.defineProperty(container, "scrollLeft", {
        get: () => current,
        set: (v: number) => {
            current = v;
        },
        configurable: true,
    });
    Object.defineProperty(container, "clientWidth", {
        value: VIEW_W,
        configurable: true,
    });
    Object.defineProperty(container, "clientLeft", {
        value: 0,
        configurable: true,
    });
    Object.defineProperty(container, "scrollWidth", {
        value: tabCount * TAB_W,
        configurable: true,
    });
    container.getBoundingClientRect = () =>
        ({ left: 0, right: VIEW_W, width: VIEW_W, top: 0, bottom: 27 }) as DOMRect;
    container.scrollTo = ((opts: ScrollToOptions) => {
        if (opts.left !== undefined) current = opts.left;
    }) as typeof container.scrollTo;

    for (let i = 0; i < tabCount; i++) {
        const t = document.createElement("div");
        // Content-space position minus the current scroll offset.
        fakeBox(t, { left: i * TAB_W - current, width: TAB_W });
        tabs.push(t);
        container.appendChild(t);
    }
    return { container, tabs };
}

describe("revealHorizontally — the three cases", () => {
    it("CASE C: does nothing when the tab is already fully visible", () => {
        const { container, tabs } = makeStrip(10, 0);
        // Tabs 0,1,2 are inside a 350px viewport.
        revealHorizontally(container, tabs[1], 8);
        expect(container.scrollLeft).toBe(0);
    });

    it("CASE B: scrolls right, minimally, when the tab is clipped on the right", () => {
        const { container, tabs } = makeStrip(10, 0);
        // Tab 4 spans content 400..500; viewport shows 0..350.
        revealHorizontally(container, tabs[4], 8);
        // end(500) - viewport(350) + margin(8) = 158
        expect(container.scrollLeft).toBe(158);
    });

    it("CASE A: scrolls left when the tab is clipped on the left", () => {
        const { container, tabs } = makeStrip(10, 400);
        // Scrolled to 400; tab 1 sits at content 100..200, i.e. off to the left.
        revealHorizontally(container, tabs[1], 8);
        // start relative = 100-400 = -300; 400 + (-300 - 8) = 92
        expect(container.scrollLeft).toBe(92);
    });

    it("is idempotent: revealing twice does not move the strip again", () => {
        const { container, tabs } = makeStrip(10, 0);
        revealHorizontally(container, tabs[4], 8);
        const after = container.scrollLeft;

        // Re-measure at the new offset, as a real browser would.
        fakeBox(tabs[4], { left: 4 * TAB_W - after, width: TAB_W });
        revealHorizontally(container, tabs[4], 8);
        expect(container.scrollLeft).toBe(after);
    });

    it("clamps to the scrollable range at the far end", () => {
        const { container, tabs } = makeStrip(4, 0);
        // scrollWidth 400, viewport 350 → max scrollLeft is 50. The margin would
        // ask for 58; it must be clamped rather than overscrolling.
        revealHorizontally(container, tabs[3], 8);
        expect(container.scrollLeft).toBe(50);
    });

    it("never scrolls below zero", () => {
        const { container, tabs } = makeStrip(10, 5);
        fakeBox(tabs[0], { left: -5, width: TAB_W });
        revealHorizontally(container, tabs[0], 8);
        expect(container.scrollLeft).toBe(0);
    });

    it("honours a zero margin", () => {
        const { container, tabs } = makeStrip(10, 0);
        revealHorizontally(container, tabs[4], 0);
        expect(container.scrollLeft).toBe(150);
    });
});

describe("CASE W — a tab wider than the viewport", () => {
    /**
     * `.tab` is a fixed 149px, so any `maxWidth` below roughly 165px makes the
     * active tab wider than the strip. Such a tab can never be "fully visible",
     * so cases A and B both apply and each overshoots past the other: the strip
     * oscillated between two offsets for as long as the tab stayed active. That
     * silently broke the idempotence the whole design leans on.
     *
     * Geometry here is built by hand rather than with `makeStrip`, because the
     * point is a tab wider than `VIEW_W`.
     */
    const WIDE = 500; // > VIEW_W (350)

    function makeWideStrip(
        scrollLeft: number,
        tabAbsLeft: number,
        scrollWidth = 2000,
    ) {
        let current = scrollLeft;
        const container = document.createElement("div");
        Object.defineProperty(container, "scrollLeft", {
            get: () => current,
            set: (v: number) => {
                current = v;
            },
            configurable: true,
        });
        Object.defineProperty(container, "clientWidth", {
            value: VIEW_W,
            configurable: true,
        });
        Object.defineProperty(container, "clientLeft", {
            value: 0,
            configurable: true,
        });
        Object.defineProperty(container, "scrollWidth", {
            value: scrollWidth,
            configurable: true,
        });
        container.getBoundingClientRect = () =>
            ({ left: 0, width: VIEW_W }) as DOMRect;
        container.scrollTo = ((opts: ScrollToOptions) => {
            if (opts.left !== undefined) current = opts.left;
        }) as typeof container.scrollTo;

        const target = document.createElement("div");
        /** Re-measure the tab against the container's current scroll offset. */
        const remeasure = () =>
            fakeBox(target, { left: tabAbsLeft - current, width: WIDE });
        remeasure();
        container.appendChild(target);
        return { container, target, remeasure };
    }

    it("aligns the leading edge instead of oscillating", () => {
        const { container, target } = makeWideStrip(600, 500);
        revealHorizontally(container, target, 8);
        // Leading edge flush with the viewport: no margin, because a margin only
        // pushes more of an already-unfittable tab out of sight.
        expect(container.scrollLeft).toBe(500);
    });

    it("converges and STAYS: repeated reveals never move the strip again", () => {
        // The regression test proper. Before the fix this alternated 142/207
        // forever with a 100px viewport; here it must settle after one step.
        const { container, target, remeasure } = makeWideStrip(600, 500);

        revealHorizontally(container, target, 8);
        const settled = container.scrollLeft;

        for (let i = 0; i < 5; i++) {
            remeasure();
            revealHorizontally(container, target, 8);
            expect(container.scrollLeft).toBe(settled);
        }
    });

    it("scrolls back leftwards to the leading edge when clipped on the left", () => {
        // Left edge off-screen to the left: the visible part is the tab's middle,
        // so the leading edge still has to be brought back into view.
        const { container, target } = makeWideStrip(700, 500);
        revealHorizontally(container, target, 8);
        expect(container.scrollLeft).toBe(500);
    });

    it("does nothing when the leading edge is already flush", () => {
        const { container, target } = makeWideStrip(500, 500);
        revealHorizontally(container, target, 8);
        expect(container.scrollLeft).toBe(500);
    });

    it("prefers the leading edge over the clamp at the far end", () => {
        // The wide tab is the LAST one, so scrollWidth is exactly its right edge
        // (1900 + 500 = 2400) and max scrollLeft is 2050. Aligning the leading
        // edge asks for 1900, which is in range and needs no clamping — whereas
        // chasing the trailing edge would ask for 2058 and be clamped to 2050,
        // pushing the tab's start off-screen. Distinguishing the two is the point
        // of this test; asserting only "it is clamped" passes either way.
        const { container, target } = makeWideStrip(0, 1900, 2400);
        revealHorizontally(container, target, 8);
        expect(container.scrollLeft).toBe(1900);
    });
});

// ---------------------------------------------------------------------------
// Hook integration: WHEN does revealing happen?
// ---------------------------------------------------------------------------

interface State {
    docs: { key: string; label: string }[];
}
const forEachTab = (
    data: State,
    visit: (t: TabDescriptor, i: number) => void,
) => data.docs.forEach((d, i) => visit({ id: d.key, title: d.label }, i));

const manyDocs: State = {
    docs: Array.from({ length: 10 }, (_, i) => ({
        key: `d${i + 1}`,
        label: `Doc ${i + 1}`,
    })),
};

/**
 * Record every scroll request made on the rendered tablist. The DOM produced by
 * TabBar is real; only the geometry is faked, so this observes the hook's real
 * decision-making.
 */
function trackScrolls() {
    const calls: number[] = [];
    const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;

    let current = 0;
    Object.defineProperty(strip, "scrollLeft", {
        get: () => current,
        set: (v: number) => {
            current = v;
        },
        configurable: true,
    });
    Object.defineProperty(strip, "clientWidth", {
        value: VIEW_W,
        configurable: true,
    });
    Object.defineProperty(strip, "clientLeft", { value: 0, configurable: true });
    Object.defineProperty(strip, "scrollWidth", {
        value: 10 * TAB_W,
        configurable: true,
    });
    strip.getBoundingClientRect = () =>
        ({ left: 0, right: VIEW_W, width: VIEW_W, top: 0, bottom: 27 }) as DOMRect;
    strip.scrollTo = ((opts: ScrollToOptions) => {
        if (opts.left !== undefined) {
            current = opts.left;
            calls.push(opts.left);
        }
    }) as typeof strip.scrollTo;

    // Lay the tabs out left-to-right in content space.
    strip.querySelectorAll<HTMLElement>('[role="tab"]').forEach((el, i) => {
        fakeBox(el, { left: i * TAB_W - current, width: TAB_W });
    });

    return calls;
}

const tabEl = (label: string) =>
    screen.getByText(label).closest(".tab")! as HTMLElement;

describe("useRevealActiveTab — when it fires", () => {
    it("reveals when the host changes the active tab EXTERNALLY", () => {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <>
                    <button onClick={() => setId("d9")}>outside</button>
                    <TabBar<State>
                        data={manyDocs}
                        forEachTab={forEachTab}
                        activeTabId={id}
                        onActiveTabSelect={setId}
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();

        // Nothing asked the component to scroll; only `activeTabId` changed.
        act(() => screen.getByText("outside").click());
        expect(calls.length).toBe(1);
        // Tab 9 spans 800..900; end - viewport + margin = 900-350+8 = 558,
        // clamped to scrollWidth(1000) - viewport(350) = 650. 558 < 650.
        expect(calls[0]).toBe(558);
    });

    it("reveals on a user click too", () => {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <TabBar<State>
                    data={manyDocs}
                    forEachTab={forEachTab}
                    activeTabId={id}
                    onActiveTabSelect={setId}
                />
            );
        }
        render(<Host />);
        const calls = trackScrolls();

        act(() => tabEl("Doc 6").click());
        expect(calls.length).toBe(1);
    });

    it("does NOT scroll when the newly active tab is already visible", () => {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <TabBar<State>
                    data={manyDocs}
                    forEachTab={forEachTab}
                    activeTabId={id}
                    onActiveTabSelect={setId}
                />
            );
        }
        render(<Host />);
        const calls = trackScrolls();

        // Doc 2 spans 100..200, inside the 350px viewport.
        act(() => tabEl("Doc 2").click());
        expect(calls).toEqual([]);
    });

    it("does NOT re-assert scroll on an unrelated re-render", () => {
        function Host() {
            const [, setTick] = useState(0);
            return (
                <>
                    <button onClick={() => setTick((t) => t + 1)}>tick</button>
                    <TabBar<State>
                        data={manyDocs}
                        forEachTab={forEachTab}
                        activeTabId="d1"
                        onActiveTabSelect={() => {}}
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;

        // Simulate the USER scrolling away by hand to inspect distant tabs. The
        // active tab (d1) is now off-screen to the left — precisely the state in
        // which an over-eager implementation would yank the view back.
        strip.scrollLeft = 600;
        strip.querySelectorAll<HTMLElement>('[role="tab"]').forEach((el, i) => {
            fakeBox(el, { left: i * TAB_W - 600, width: TAB_W });
        });

        // Unrelated parent re-renders must leave the user's scroll position
        // alone: `activeId` did not change, so nothing should be revealed.
        act(() => screen.getByText("tick").click());
        act(() => screen.getByText("tick").click());
        expect(calls).toEqual([]);
        expect(strip.scrollLeft).toBe(600);
    });

    it("does nothing when revealActiveTab is false", () => {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <>
                    <button onClick={() => setId("d9")}>outside</button>
                    <TabBar<State>
                        data={manyDocs}
                        forEachTab={forEachTab}
                        activeTabId={id}
                        onActiveTabSelect={setId}
                        revealActiveTab={false}
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();

        act(() => screen.getByText("outside").click());
        expect(calls).toEqual([]);
    });

    it("honours a custom margin from revealActiveTab options", () => {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <>
                    <button onClick={() => setId("d9")}>outside</button>
                    <TabBar<State>
                        data={manyDocs}
                        forEachTab={forEachTab}
                        activeTabId={id}
                        onActiveTabSelect={setId}
                        revealActiveTab={{ margin: 0 }}
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();

        act(() => screen.getByText("outside").click());
        expect(calls[0]).toBe(550); // 900 - 350 + 0
    });

    it("does NOT reveal on a reorder — but scrollLeft is preserved, so a\n       comfortably-placed active tab stays visible anyway", () => {
        function Host() {
            const [docs, setDocs] = useState(manyDocs.docs);
            return (
                <>
                    <button
                        onClick={() =>
                            setDocs((prev) => {
                                // Move tab 0 to position 5: every tab between
                                // shifts LEFT one slot, including the active one.
                                const next = [...prev];
                                const [moved] = next.splice(0, 1);
                                next.splice(5, 0, moved);
                                return next;
                            })
                        }
                    >
                        reorder
                    </button>
                    <TabBar<State>
                        data={{ docs }}
                        forEachTab={forEachTab}
                        activeTabId="d3"
                        onActiveTabSelect={() => {}}
                        onTabReorder={() => {}}
                        reorderable
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;

        act(() => screen.getByText("reorder").click());

        // The hook did nothing: `activeId` never changed.
        expect(calls).toEqual([]);
        // And it did not need to. `scrollLeft` belongs to the CONTAINER, so a
        // reorder leaves the viewport where it was; the active tab (d3, keys are
        // 1-based so it starts at index 2) merely moved one slot left to index 1,
        // and was already well inside view.
        expect(strip.scrollLeft).toBe(0);
        const tabs = [...strip.querySelectorAll('[role="tab"]')];
        const idx = tabs.findIndex(
            (t) => t.getAttribute("aria-selected") === "true",
        );
        expect(idx).toBe(1);
        expect(idx * TAB_W).toBeGreaterThanOrEqual(0);
        expect((idx + 1) * TAB_W).toBeLessThanOrEqual(VIEW_W);
    });

    it("documents the edge case: a reorder CAN clip an active tab that sits\n       right at the viewport edge", () => {
        function Host() {
            const [docs, setDocs] = useState(manyDocs.docs);
            return (
                <>
                    <button
                        onClick={() =>
                            setDocs((prev) => {
                                // Move the LAST tab to the FRONT: everything
                                // shifts RIGHT one slot, pushing the active tab
                                // further out of view.
                                const next = [...prev];
                                const [moved] = next.splice(9, 1);
                                next.splice(0, 0, moved);
                                return next;
                            })
                        }
                    >
                        push-right
                    </button>
                    <TabBar<State>
                        data={{ docs }}
                        forEachTab={forEachTab}
                        activeTabId="d4"
                        onActiveTabSelect={() => {}}
                        onTabReorder={() => {}}
                        reorderable
                    />
                </>
            );
        }
        render(<Host />);
        const calls = trackScrolls();
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;

        // Place the active tab (d4, index 3 → content 300..400) flush against
        // the right edge: scrollLeft 58 puts it at screen 242..342 of 350.
        strip.scrollLeft = 58;

        act(() => screen.getByText("push-right").click());

        // Active tab is now at index 4 → content 400..500, screen 342..442.
        const tabs = [...strip.querySelectorAll('[role="tab"]')];
        const idx = tabs.findIndex(
            (t) => t.getAttribute("aria-selected") === "true",
        );
        expect(idx).toBe(4);

        const start = idx * TAB_W - strip.scrollLeft;
        const end = start + TAB_W;
        // It is genuinely clipped...
        expect(end).toBeGreaterThan(VIEW_W);
        // ...and no reveal fired, because `activeId` did not change. This is the
        // documented trade of the single-trigger design, not a bug: adding
        // `activeIndex` as a dependency would fix it at the cost of re-asserting
        // scroll on mutations the user did not initiate.
        expect(calls).toEqual([]);
    });

    it("does nothing when nothing is active", () => {
        const { rerender } = render(
            <TabBar<State>
                data={manyDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={() => {}}
            />,
        );
        const calls = trackScrolls();

        act(() => {
            rerender(
                <TabBar<State>
                    data={manyDocs}
                    forEachTab={forEachTab}
                    activeTabId={null}
                    onActiveTabSelect={() => {}}
                />,
            );
        });
        expect(calls).toEqual([]);
    });
});

describe("scroll behavior is programmable", () => {
    /** Capture the `behavior` passed to scrollTo. */
    function trackBehavior() {
        const behaviors: (ScrollBehavior | undefined)[] = [];
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;
        let current = 0;
        Object.defineProperty(strip, "scrollLeft", {
            get: () => current,
            set: (v: number) => {
                current = v;
            },
            configurable: true,
        });
        Object.defineProperty(strip, "clientWidth", {
            value: VIEW_W,
            configurable: true,
        });
        Object.defineProperty(strip, "clientLeft", {
            value: 0,
            configurable: true,
        });
        Object.defineProperty(strip, "scrollWidth", {
            value: 10 * TAB_W,
            configurable: true,
        });
        strip.getBoundingClientRect = () =>
            ({ left: 0, right: VIEW_W, width: VIEW_W }) as DOMRect;
        strip.scrollTo = ((opts: ScrollToOptions) => {
            behaviors.push(opts.behavior);
            if (opts.left !== undefined) current = opts.left;
        }) as typeof strip.scrollTo;
        strip.querySelectorAll<HTMLElement>('[role="tab"]').forEach((el, i) => {
            fakeBox(el, { left: i * TAB_W, width: TAB_W });
        });
        return behaviors;
    }

    function renderWithReveal(reveal?: boolean | { behavior?: ScrollBehavior }) {
        function Host() {
            const [id, setId] = useState<string | null>("d1");
            return (
                <>
                    <button onClick={() => setId("d9")}>outside</button>
                    <TabBar<State>
                        data={manyDocs}
                        forEachTab={forEachTab}
                        activeTabId={id}
                        onActiveTabSelect={setId}
                        revealActiveTab={reveal}
                    />
                </>
            );
        }
        render(<Host />);
    }

    it("defaults to instant, so it never feels laggy", () => {
        renderWithReveal(true);
        const behaviors = trackBehavior();
        act(() => screen.getByText("outside").click());
        expect(behaviors).toEqual(["instant"]);
    });

    it("can be set to smooth", () => {
        renderWithReveal({ behavior: "smooth" });
        const behaviors = trackBehavior();
        act(() => screen.getByText("outside").click());
        expect(behaviors).toEqual(["smooth"]);
    });

    describe("with prefers-reduced-motion: reduce", () => {
        beforeEach(() => {
            vi.stubGlobal(
                "matchMedia",
                (q: string) =>
                    ({
                        matches: q.includes("prefers-reduced-motion"),
                        media: q,
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    }) as unknown as MediaQueryList,
            );
        });
        afterEach(() => vi.unstubAllGlobals());

        it("downgrades smooth to instant", () => {
            renderWithReveal({ behavior: "smooth" });
            const behaviors = trackBehavior();
            act(() => screen.getByText("outside").click());
            expect(behaviors).toEqual(["instant"]);
        });
    });
});

describe("maxWidth", () => {
    it("applies a number as pixels", () => {
        render(
            <TabBar<State>
                data={manyDocs}
                forEachTab={forEachTab}
                maxWidth={400}
            />,
        );
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;
        expect(strip.style.maxWidth).toBe("400px");
    });

    it("passes a string through verbatim, so relative units work", () => {
        render(
            <TabBar<State>
                data={manyDocs}
                forEachTab={forEachTab}
                maxWidth="50%"
            />,
        );
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;
        expect(strip.style.maxWidth).toBe("50%");
    });

    it("sets no inline style when omitted", () => {
        render(<TabBar<State> data={manyDocs} forEachTab={forEachTab} />);
        const strip = document.querySelector<HTMLElement>('[role="tablist"]')!;
        expect(strip.getAttribute("style")).toBeNull();
    });
});
