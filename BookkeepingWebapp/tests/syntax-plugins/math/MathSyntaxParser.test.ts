import { describe, it, expect } from "vitest";
import { mathSyntaxPlugin } from "../../../src/syntax-plugins/math";

describe("math syntax plugin", () => {
    it("should parse valid math expressions", () => {
        expect(mathSyntaxPlugin.parse("1+1")).toMatchObject({
            type: "BinaryExpression",
            operator: "+",
            left: { type: "NumberLiteral", value: 1 },
            right: { type: "NumberLiteral", value: 1 },
        });
    });
    it("polynomial math expression", () => {
        expect(mathSyntaxPlugin.parse("5x^3+6x+7")).toMatchObject({
            type: "BinaryExpression",
            operator: "+",
            left: {
                type: "BinaryExpression",
                operator: "+",
                left: {
                    type: "BinaryExpression",
                    operator: "*",
                    left: { type: "NumberLiteral", value: 5 },
                    right: {
                        type: "BinaryExpression",
                        operator: "^",
                        left: { type: "Identifier", name: "x", prefix: "plain" },
                        right: { type: "NumberLiteral", value: 3 },
                    },
                },
                right: {
                    type: "BinaryExpression",
                    operator: "*",
                    left: { type: "NumberLiteral", value: 6 },
                    right: { type: "Identifier", name: "x", prefix: "plain" },
                },
            },
            right: { type: "NumberLiteral", value: 7 },
        });
    });
    it("Trigonometric math expression", () => {
        expect(mathSyntaxPlugin.parse("2\\sin^2(5x+3)")).toMatchObject({"type":"BinaryExpression","operator":"*","left":{"type":"NumberLiteral","value":2},"right":{"type":"BinaryExpression","operator":"^","left":{"type":"Identifier","name":"sin","prefix":"greek"},"right":{"type":"CallExpression","callee":{"type":"NumberLiteral","value":2},"args":[{"type":"BinaryExpression","operator":"+","left":{"type":"BinaryExpression","operator":"*","left":{"type":"NumberLiteral","value":5},"right":{"type":"Identifier","name":"x","prefix":"plain"}},"right":{"type":"NumberLiteral","value":3}}]}}})
    })
});

