import { describe, it, expect } from "vitest";
import { AbstractParser } from "../src/parser/AbstractParser";
import type { Syntax } from "../src/parser/types";

// A minimal grammar with whitespace skipping (like the real math parser)
const testSyntax: Syntax = {
    Start: {
        peg: {
            type: "sequence",
            parts: [
                { type: "rule", name: "Number" },
                { type: "literal", value: "+" },
                { type: "rule", name: "Number" },
            ],
        },
        build([left, , right]: [string, string, string]) {
            return { left, op: "+", right };
        },
    },
    Number: {
        peg: { type: "regex", regex: /^[0-9]+/, name: "number" },
    },
};

const parser = new AbstractParser(testSyntax, { skip: /^[ \t]+/ });

describe("AbstractParser error reporting", () => {
    describe("parse failure (unexpected token)", () => {
        it("shows position for unexpected character", () => {
            expect(() => parser.parse("Start", "3 + @")).toThrow(
                /inputString:1:5/,
            );
        });

        it("shows expected tokens", () => {
            expect(() => parser.parse("Start", "3 + @")).toThrow(
                /expected:.*number/,
            );
        });

        it("shows the offending character", () => {
            expect(() => parser.parse("Start", "3 + @")).toThrow(
                /unexpected '@'/,
            );
        });

        it("shows EOF when input is incomplete", () => {
            expect(() => parser.parse("Start", "3 +")).toThrow(
                /unexpected 'EOF'/,
            );
        });

        it("reports trailing garbage after valid parse", () => {
            // The parser records failure at the space before "garbage"
            // because skip hasn't consumed it yet at the EOF check
            expect(() => parser.parse("Start", "3 + 5 garbage")).toThrow(
                /unexpected ' '/,
            );
            expect(() => parser.parse("Start", "3 + 5 garbage")).toThrow(
                /expected:.*EOF/,
            );
        });

        it("reports correct position on multi-char input", () => {
            // "123 * 456": after parsing 123, expects "+", finds "*" at column 5
            expect(() => parser.parse("Start", "123 * 456")).toThrow(
                /inputString:1:5/,
            );
        });
    });

    describe("unknown rule error", () => {
        it("shows position when a referenced rule does not exist", () => {
            const brokenSyntax: Syntax = {
                Start: {
                    peg: { type: "rule", name: "NonExistentRule" },
                },
            };
            const p = new AbstractParser(brokenSyntax);
            expect(() => p.parse("Start", "hello")).toThrow(
                /unknown rule: NonExistentRule/,
            );
            expect(() => p.parse("Start", "hello")).toThrow(
                /inputString:1:1/,
            );
        });

        it("shows position mid-input when unknown rule is hit later", () => {
            const brokenSyntax: Syntax = {
                Start: {
                    peg: {
                        type: "sequence",
                        parts: [
                            { type: "literal", value: "abc" },
                            { type: "rule", name: "Missing" },
                        ],
                    },
                },
            };
            const p = new AbstractParser(brokenSyntax);
            expect(() => p.parse("Start", "abc xyz")).toThrow(
                /unknown rule: Missing/,
            );
            expect(() => p.parse("Start", "abc xyz")).toThrow(
                /inputString:1:4/,
            );
        });
    });

    describe("unknown PEG node type error", () => {
        it("shows position and the bad node type", () => {
            const brokenSyntax: Syntax = {
                Start: {
                    peg: { type: "bogus" as any, value: "x" },
                },
            };
            const p = new AbstractParser(brokenSyntax);
            expect(() => p.parse("Start", "anything")).toThrow(
                /unknown PEG node type: bogus/,
            );
            expect(() => p.parse("Start", "anything")).toThrow(
                /inputString:1:1/,
            );
        });
    });

    describe("caret and line display", () => {
        it("points caret at the exact error column", () => {
            try {
                parser.parse("Start", "3 + @");
                expect.fail("should have thrown");
            } catch (e: any) {
                const lines = e.message.split("\n");
                // Find the source line and caret line
                const srcLineIdx = lines.findIndex((l: string) =>
                    l.includes("| 3 + @"),
                );
                expect(srcLineIdx).toBeGreaterThan(-1);
                const caretLine = lines[srcLineIdx + 1];
                // The ^ should point at column 5 (the @)
                const afterPrefix = caretLine.split("| ")[1];
                expect(afterPrefix?.trim()).toBe("^");
                expect(afterPrefix?.indexOf("^")).toBe(4); // 0-indexed col 5
            }
        });
    });
});

describe("SyntaxParser (math) error reporting", () => {
    it("reports error position for malformed math input", async () => {
        const { syntaxParser } = await import(
            "../src/syntax-plugins/math/SyntaxParser"
        );
        expect(() => syntaxParser.parse("Expression", "3 + @")).toThrow(
            /inputString:1:5/,
        );
    });

    it("reports error for unclosed parenthesis", async () => {
        const { syntaxParser } = await import(
            "../src/syntax-plugins/math/SyntaxParser"
        );
        expect(() => syntaxParser.parse("Expression", "(3 + 5")).toThrow(
            /unexpected/,
        );
    });

    it("reports error for invalid operator", async () => {
        const { syntaxParser } = await import(
            "../src/syntax-plugins/math/SyntaxParser"
        );
        expect(() => syntaxParser.parse("Expression", "3 & 5")).toThrow(
            /unexpected '&'/,
        );
    });
});
