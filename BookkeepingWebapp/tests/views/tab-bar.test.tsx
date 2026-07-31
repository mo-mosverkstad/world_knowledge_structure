// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TabBar } from "../../src/views/tab-bar";
import {
    type ActiveTabSelectReason,
    type TabDescriptor,
} from "../../src/views/tab-bar";

afterEach(cleanup);

/** Minimal business data structure exercising the data port. */
interface State {
    docs: { key: string; label: string }[];
}

const forEachTab = (
    data: State,
    visit: (tab: TabDescriptor, index: number) => void,
) => data.docs.forEach((d, i) => visit({ id: d.key, title: d.label }, i));

const threeDocs: State = {
    docs: [
        { key: "d1", label: "One" },
        { key: "d2", label: "Two" },
        { key: "d3", label: "Three" },
    ],
};

const tab = (label: string) => screen.getByText(label).closest(".tab")!;
const isActive = (label: string) => tab(label).classList.contains("tab--active");

describe("active-tab port — read half (activeTabId)", () => {
    it("renders the controlled tab as active", () => {
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d2"
                onActiveTabSelect={() => {}}
            />,
        );
        expect(isActive("Two")).toBe(true);
        expect(isActive("One")).toBe(false);
    });

    it("treats null as 'nothing active' rather than as uncontrolled", () => {
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId={null}
                onActiveTabSelect={() => {}}
            />,
        );
        // The old `activeTabId?: string` could not express this: it would have
        // fallen back to internal state and activated the first tab.
        expect(isActive("One")).toBe(false);
        expect(isActive("Two")).toBe(false);
        expect(isActive("Three")).toBe(false);
    });

    it("lets a host REST in null — no request is made to fill the gap", () => {
        // The test above only proves the *render* is right, and it does so with a
        // host that ignores requests. A host doing what the docs say (applying
        // the request) used to be dragged straight off null onto the first tab,
        // because seeding was implemented as a vanished-tab fallback.
        const onActiveTabSelect = vi.fn();
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId={null}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        expect(onActiveTabSelect).not.toHaveBeenCalled();

        // Re-rendering must not accumulate requests either: the old code
        // re-proposed the first tab on EVERY render, since the loop guard
        // compared "d1" against null and never matched.
        act(() => {
            rerender(
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    activeTabId={null}
                    onActiveTabSelect={onActiveTabSelect}
                />,
            );
        });
        expect(onActiveTabSelect).not.toHaveBeenCalled();
    });

    it("stays on null when the host honours every request it receives", () => {
        // The end-to-end version of the above: a cooperating host, wired exactly
        // as the README tells hosts to wire themselves.
        const seen: (string | null)[] = [];
        function Host() {
            const [activeId, setActiveId] = useState<string | null>(null);
            seen.push(activeId);
            return (
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    activeTabId={activeId}
                    onActiveTabSelect={setActiveId}
                />
            );
        }
        render(<Host />);

        expect(seen).toEqual([null]);
        expect(isActive("One")).toBe(false);
    });

    it("clears to null after a tab was active, and stays there", () => {
        const onActiveTabSelect = vi.fn();
        function Host() {
            const [activeId, setActiveId] = useState<string | null>("d2");
            return (
                <>
                    <button onClick={() => setActiveId(null)}>clear</button>
                    <TabBar<State>
                        data={threeDocs}
                        forEachTab={forEachTab}
                        activeTabId={activeId}
                        onActiveTabSelect={(id, data, reason) => {
                            onActiveTabSelect(id, data, reason);
                            setActiveId(id);
                        }}
                    />
                </>
            );
        }
        render(<Host />);
        expect(isActive("Two")).toBe(true);

        act(() => screen.getByText("clear").click());
        expect(isActive("Two")).toBe(false);
        expect(onActiveTabSelect).not.toHaveBeenCalled();
    });

    it("follows external modification of the controlled value", () => {
        function Host() {
            const [activeId, setActiveId] = useState<string | null>("d1");
            return (
                <>
                    {/* Changes the active tab WITHOUT going through the component. */}
                    <button onClick={() => setActiveId("d3")}>outside</button>
                    <TabBar<State>
                        data={threeDocs}
                        forEachTab={forEachTab}
                        activeTabId={activeId}
                        onActiveTabSelect={setActiveId}
                    />
                </>
            );
        }
        render(<Host />);
        expect(isActive("One")).toBe(true);

        act(() => screen.getByText("outside").click());
        expect(isActive("Three")).toBe(true);
        expect(isActive("One")).toBe(false);
    });
});

describe("active-tab port — write half (onActiveTabSelect)", () => {
    it("requests a change on user activation, tagged 'user-select'", () => {
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );

        act(() => (tab("Two") as HTMLElement).click());
        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d2",
            threeDocs,
            "user-select" satisfies ActiveTabSelectReason,
        );
    });

    it("does not move the active tab when the host ignores the request", () => {
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={() => {
                    /* deliberately refuses, e.g. an unsaved-changes guard */
                }}
            />,
        );

        act(() => (tab("Two") as HTMLElement).click());
        expect(isActive("One")).toBe(true);
        expect(isActive("Two")).toBe(false);
    });

    it("fires in uncontrolled mode too, so a host can observe without owning", () => {
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );

        act(() => (tab("Three") as HTMLElement).click());
        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d3",
            threeDocs,
            "user-select",
        );
        // and the component applied it itself, since it owns the value here
        expect(isActive("Three")).toBe(true);
    });
});

describe("fallback — the active tab vanished", () => {
    it("tells a CONTROLLED host, which the old reconcile() swallowed", () => {
        const onActiveTabSelect = vi.fn();
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d2"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        onActiveTabSelect.mockClear();

        const without2: State = {
            docs: threeDocs.docs.filter((d) => d.key !== "d2"),
        };
        act(() => {
            rerender(
                <TabBar<State>
                    data={without2}
                    forEachTab={forEachTab}
                    activeTabId="d2"
                    onActiveTabSelect={onActiveTabSelect}
                />,
            );
        });

        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d1",
            without2,
            "fallback" satisfies ActiveTabSelectReason,
        );
    });

    it("proposes null when no tabs remain", () => {
        const onActiveTabSelect = vi.fn();
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        onActiveTabSelect.mockClear();

        const empty: State = { docs: [] };
        act(() => {
            rerender(
                <TabBar<State>
                    data={empty}
                    forEachTab={forEachTab}
                    activeTabId="d1"
                    onActiveTabSelect={onActiveTabSelect}
                />,
            );
        });

        expect(onActiveTabSelect).toHaveBeenCalledWith(
            null,
            empty,
            "fallback",
        );
    });

    it("does not loop when a controlled host ignores the fallback", () => {
        const onActiveTabSelect = vi.fn();
        const without1: State = {
            docs: threeDocs.docs.filter((d) => d.key !== "d1"),
        };
        // Active id "d1" is already absent on first render, and the host never
        // applies the proposed replacement. The request must not repeat forever.
        render(
            <TabBar<State>
                data={without1}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );

        expect(onActiveTabSelect).toHaveBeenCalledTimes(1);
        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d2",
            without1,
            "fallback",
        );
    });

    it("still self-heals in uncontrolled mode", () => {
        const { rerender } = render(
            <TabBar<State> data={threeDocs} forEachTab={forEachTab} />,
        );
        act(() => (tab("Two") as HTMLElement).click());
        expect(isActive("Two")).toBe(true);

        const without2: State = {
            docs: threeDocs.docs.filter((d) => d.key !== "d2"),
        };
        act(() => {
            rerender(<TabBar<State> data={without2} forEachTab={forEachTab} />);
        });

        expect(isActive("One")).toBe(true);
    });
});

describe("onActiveTabChange — notification with derived index", () => {
    it("reports the id and its position in the traversal", () => {
        const onActiveTabChange = vi.fn();
        function Host() {
            const [activeId, setActiveId] = useState<string | null>("d1");
            return (
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    activeTabId={activeId}
                    onActiveTabSelect={setActiveId}
                    onActiveTabChange={onActiveTabChange}
                />
            );
        }
        render(<Host />);
        onActiveTabChange.mockClear();

        act(() => (tab("Three") as HTMLElement).click());
        expect(onActiveTabChange).toHaveBeenCalledWith("d3", 2, threeDocs);
    });

    it("reports a null index when nothing is active", () => {
        const onActiveTabChange = vi.fn();
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={() => {}}
                onActiveTabChange={onActiveTabChange}
            />,
        );
        onActiveTabChange.mockClear();

        act(() => {
            rerender(
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    activeTabId={null}
                    onActiveTabSelect={() => {}}
                    onActiveTabChange={onActiveTabChange}
                />,
            );
        });

        expect(onActiveTabChange).toHaveBeenCalledWith(null, null, threeDocs);
    });

    it("tracks the index across a reorder without the id changing", () => {
        const onActiveTabChange = vi.fn();
        const reordered: State = {
            docs: [threeDocs.docs[1], threeDocs.docs[0], threeDocs.docs[2]],
        };
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onActiveTabSelect={() => {}}
                onActiveTabChange={onActiveTabChange}
            />,
        );

        act(() => {
            rerender(
                <TabBar<State>
                    data={reordered}
                    forEachTab={forEachTab}
                    activeTabId="d1"
                    onActiveTabSelect={() => {}}
                    onActiveTabChange={onActiveTabChange}
                />,
            );
        });

        // "d1" moved from index 0 to index 1. The id is the stable address;
        // the index is derived, which is exactly why it is read-only.
        expect(isActive("One")).toBe(true);
        expect(tab("Two").previousSibling).toBeNull();
    });
});

describe("uncontrolled mode is unchanged", () => {
    it("activates the first tab by default", () => {
        render(<TabBar<State> data={threeDocs} forEachTab={forEachTab} />);
        expect(isActive("One")).toBe(true);
    });

    it("honours defaultActiveTabId", () => {
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                defaultActiveTabId="d3"
            />,
        );
        expect(isActive("Three")).toBe(true);
    });

    it("selects on click", () => {
        render(<TabBar<State> data={threeDocs} forEachTab={forEachTab} />);
        act(() => (tab("Two") as HTMLElement).click());
        expect(isActive("Two")).toBe(true);
        expect(isActive("One")).toBe(false);
    });
});

describe("seeding the first active tab — reason 'initial'", () => {
    it("reports the default seed as 'initial', not as a 'fallback'", () => {
        // Nothing was deleted on a fresh mount, so calling this a fallback told
        // the host "your active tab no longer exists" about a tab that never
        // existed. Seeding is its own reason.
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );

        expect(onActiveTabSelect).toHaveBeenCalledTimes(1);
        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d1",
            threeDocs,
            "initial" satisfies ActiveTabSelectReason,
        );
        expect(isActive("One")).toBe(true);
    });

    it("seeds at most once, even across re-renders", () => {
        const onActiveTabSelect = vi.fn();
        const { rerender } = render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        act(() => {
            rerender(
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    onActiveTabSelect={onActiveTabSelect}
                />,
            );
        });
        expect(onActiveTabSelect).toHaveBeenCalledTimes(1);
    });

    it("does not seed when an explicit defaultActiveTabId states the value", () => {
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                defaultActiveTabId="d3"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        expect(isActive("Three")).toBe(true);
        expect(onActiveTabSelect).not.toHaveBeenCalled();
    });

    it("honours an explicit defaultActiveTabId of null: starts with nothing active", () => {
        // The uncontrolled mirror of "a host may rest in null".
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                defaultActiveTabId={null}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        expect(isActive("One")).toBe(false);
        expect(isActive("Two")).toBe(false);
        expect(isActive("Three")).toBe(false);
        expect(onActiveTabSelect).not.toHaveBeenCalled();
    });

    it("still selects normally after starting from an explicit null", () => {
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                defaultActiveTabId={null}
            />,
        );
        act(() => (tab("Two") as HTMLElement).click());
        expect(isActive("Two")).toBe(true);
    });

    it("defers seeding until tabs actually exist", () => {
        const onActiveTabSelect = vi.fn();
        const empty: State = { docs: [] };
        const { rerender } = render(
            <TabBar<State>
                data={empty}
                forEachTab={forEachTab}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        // Nothing to seed with yet — and crucially not a null "fallback".
        expect(onActiveTabSelect).not.toHaveBeenCalled();

        act(() => {
            rerender(
                <TabBar<State>
                    data={threeDocs}
                    forEachTab={forEachTab}
                    onActiveTabSelect={onActiveTabSelect}
                />,
            );
        });
        expect(onActiveTabSelect).toHaveBeenCalledWith(
            "d1",
            threeDocs,
            "initial",
        );
        expect(isActive("One")).toBe(true);
    });

    it("a controlled host is never seeded — it states its own initial value", () => {
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d2"
                onActiveTabSelect={onActiveTabSelect}
            />,
        );
        expect(onActiveTabSelect).not.toHaveBeenCalled();
    });
});

describe("onTabClick stays a free-form behavior hook", () => {
    it("fires independently of the selection request", () => {
        const onTabClick = vi.fn();
        const onActiveTabSelect = vi.fn();
        render(
            <TabBar<State>
                data={threeDocs}
                forEachTab={forEachTab}
                activeTabId="d1"
                onTabClick={onTabClick}
                onActiveTabSelect={onActiveTabSelect}
            />,
        );

        act(() => (tab("Two") as HTMLElement).click());
        expect(onTabClick).toHaveBeenCalledWith("d2", threeDocs);
        expect(onActiveTabSelect).toHaveBeenCalledTimes(1);
    });
});
