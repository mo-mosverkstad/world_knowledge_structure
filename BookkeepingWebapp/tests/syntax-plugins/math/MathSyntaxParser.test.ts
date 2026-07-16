import { describe, it, expect } from "vitest";
import { mathSyntaxPlugin } from "../../../src/syntax-plugins/math";
import type { MathNode } from "../../../src/syntax-plugins/math/types";

// ── Test helpers ─────────────────────────────────────────────────────────────

function parse(input: string): MathNode { return mathSyntaxPlugin.parse(input) as MathNode; }
function num(value: number) { return { type: "NumberLiteral", value }; }
function id(name: string, prefix = "plain") { return { type: "Identifier", name, prefix }; }
function bin(op: string, left: object, right: object) { return { type: "BinaryExpression", operator: op, left, right }; }
function frac(numerator: object, denominator: object) { return { type: "FractionExpression", numerator, denominator }; }
function unary(op: string, operand: object) { return { type: "UnaryExpression", operator: op, operand }; }
function call(callee: object, args: object[]) { return { type: "CallExpression", callee, args }; }
function control(name: string, args: object[]) { return { type: "ControlExpression", name, args }; }
function subscript(base: object, sub: object) { return { type: "SubscriptExpression", base, subscript: sub }; }
function factorial(base: object) { return { type: "FactorialExpression", base }; }
function derivative(base: object, order: number) { return { type: "Derivative", base, order }; }
function index(base: object, idx: object) { return { type: "IndexExpression", base, index: idx }; }
function subsup(base: object, sub: object, sup: object) { return { type: "SubSuperscriptExpression", base, subscript: sub, superscript: sup }; }
function vector(identifier: object) { return { type: "VectorName", identifier }; }
function abs(expr: object) { return { type: "AbsoluteValue", expr }; }
function tuple(elements: object[]) { return { type: "Tuple", elements }; }
function matrix(rows: object[][]) { return { type: "Matrix", rows }; }

function parse_check(title: string, input: string, expected: object) {
    it(title, () => { expect(parse(input)).toMatchObject(expected); });
}

function parse_fail(title: string, input: string, match: string | RegExp) {
    it(title, () => { expect(() => parse(input)).toThrow(match); });
}

function parse_type(title: string, input: string, type: string) {
    it(title, () => { expect((parse(input) as any).type).toBe(type); });
}

function parse_prop(title: string, input: string, path: string, expected: any) {
    it(title, () => {
        let value: any = parse(input);
        for (const key of path.split(".")) value = value[key];
        if (typeof expected === "object" && expected !== null) expect(value).toMatchObject(expected);
        else expect(value).toBe(expected);
    });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Number literals", () => {
    parse_check("integer", "42", num(42));
    parse_check("decimal", "3.14", num(3.14));
    parse_check("leading-dot decimal", ".5", num(0.5));
});

describe("Identifiers", () => {
    parse_check("plain Latin", "x", id("x"));
    parse_check("left-skew Latin", "`a", id("a", "left-skew"));
    parse_check("right-skew Latin", "`1T", id("T", "right-skew"));
    parse_check("Greek upright", "\\a", id("a", "greek"));
    parse_check("Greek right-skew", "\\1b", id("b", "greek-right"));
    parse_prop("right-skew before left-skew", "`1T", "prefix", "right-skew");
    parse_prop("right-skew Greek before plain Greek", "\\1a", "prefix", "greek-right");
    parse_check("blackboard bold", "\\\\R", id("R", "blackboard"));
    parse_check("multi-letter backslash", "\\sin", id("sin", "greek"));
    parse_check("multi-letter with digits", "\\ha", id("ha", "greek"));
});

describe("Additive", () => {
    parse_check("addition", "a+b", bin("+", id("a"), id("b")));
    parse_check("subtraction", "a-b", bin("-", id("a"), id("b")));
    parse_check("left-associative chain", "a+b+c", bin("+", bin("+", id("a"), id("b")), id("c")));
    parse_check("whitespace ignored", "a + b", bin("+", id("a"), id("b")));
});

describe("Multiplicative", () => {
    parse_check("explicit multiply", "a*b", bin("*", id("a"), id("b")));
    parse_check("division", "a/b", frac(id("a"), id("b")));
    parse_check("division binds tighter than multiply on the right", "a*b/c", bin("*", id("a"), frac(id("b"), id("c"))));
    parse_check("parenthesized product can be numerator", "(a*b)/c", frac(bin("*", id("a"), id("b")), id("c")));
    parse_check("implicit product can include fraction", "2x/y", bin("*", num(2), frac(id("x"), id("y"))));
    parse_check("implicit 2x", "2x", bin("*", num(2), id("x")));
    parse_check("implicit f(x)y", "f(x)y", bin("*", call(id("f"), [id("x")]), id("y")));
    parse_check("higher precedence than additive", "a+b*c", bin("+", id("a"), bin("*", id("b"), id("c"))));
    parse_check("dot product", "u.v", bin(".", id("u"), id("v")));
    parse_prop("regression: (3+5) not 3*(+5)", "2*(3+5)", "right.operator", "+");
    parse_prop("regression: -2*(3+5)*4e^x^2 outer op", "-2*(3+5)*4e^x^2", "operator", "*");
    parse_prop("regression: -2*(3+5)*4e^x^2 right op", "-2*(3+5)*4e^x^2", "right.operator", "^");
});

describe("Power", () => {
    parse_check("basic", "x^2", bin("^", id("x"), num(2)));
    parse_check("right-associative x^2^3", "x^2^3", bin("^", id("x"), bin("^", num(2), num(3))));
    parse_check("right-associative chain a^b^c^d", "a^b^c^d", bin("^", id("a"), bin("^", id("b"), bin("^", id("c"), id("d")))));
});

describe("Unary", () => {
    parse_check("negation", "-x", unary("-", id("x")));
    parse_fail("unary plus not allowed", "+x", /unexpected/);
    parse_check("double negation", "--x", unary("-", unary("-", id("x"))));
});

describe("Postfix — function call", () => {
    parse_check("no-arg", "f()", call(id("f"), []));
    parse_check("single-arg", "f(x)", call(id("f"), [id("x")]));
    parse_check("multi-arg", "f(x,y)", call(id("f"), [id("x"), id("y")]));
    parse_check("chained g(x)(y)", "g(x)(y)", call(call(id("g"), [id("x")]), [id("y")]));
});

describe("Postfix — subscript", () => {
    parse_check("simple", "x_i", subscript(id("x"), id("i")));
    parse_check("numeric", "x_0", subscript(id("x"), num(0)));
});

describe("Postfix — control", () => {
    parse_check("\\int with three args", "\\int{0, 1, x}", control("int", [num(0), num(1), id("x")]));
    parse_check("\\sqrt with one arg", "\\sqrt{x}", control("sqrt", [id("x")]));
    parse_check("generic", "\\foo{a, b}", control("foo", [id("a"), id("b")]));
});

describe("Postfix — factorial", () => {
    parse_check("simple", "n!", factorial(id("n")));
    parse_prop("does not consume !=", "x != y", "operator", "!=");
    parse_type("on group (n+1)!", "(n+1)!", "FactorialExpression");
});

describe("Postfix — derivative", () => {
    parse_check("single prime", "f'", derivative(id("f"), 1));
    parse_prop("double prime", "f''", "order", 2);
    parse_check("derivative with call f'(x)", "f'(x)", call(derivative(id("f"), 1), [id("x")]));
});

describe("Postfix — index", () => {
    parse_check("A[k]", "A[k]", index(id("A"), id("k")));
    parse_check("A[0]", "A[0]", index(id("A"), num(0)));
});

describe("Grouping", () => {
    parse_check("unwraps (x)", "(x)", id("x"));
    parse_check("changes precedence", "(a+b)*c", bin("*", bin("+", id("a"), id("b")), id("c")));
});

describe("Operator precedence", () => {
    parse_check("^ > * > +", "a+b*c^d", bin("+", id("a"), bin("*", id("b"), bin("^", id("c"), id("d")))));
    parse_check("unary inside power: -a^2 = (-a)^2", "-a^2", bin("^", unary("-", id("a")), num(2)));
});

describe("Relational operators", () => {
    parse_check("=", "a = b", bin("=", id("a"), id("b")));
    parse_check("!=", "a != b", bin("!=", id("a"), id("b")));
    parse_check("<=", "a <= b", bin("<=", id("a"), id("b")));
    parse_check(">=", "a >= b", bin(">=", id("a"), id("b")));
    parse_check("~=", "a ~= b", bin("~=", id("a"), id("b")));
    parse_check(":=", "a := b", bin(":=", id("a"), id("b")));
    parse_check("~", "a ~ b", bin("~", id("a"), id("b")));
    parse_check("<<", "a << b", bin("<<", id("a"), id("b")));
    parse_check(">>", "a >> b", bin(">>", id("a"), id("b")));
    parse_check("->", "x -> a", bin("->", id("x"), id("a")));
    parse_check("<", "a < b", bin("<", id("a"), id("b")));
    parse_check(">", "a > b", bin(">", id("a"), id("b")));
    parse_check("lower precedence than additive", "a+1=b", bin("=", bin("+", id("a"), num(1)), id("b")));
    parse_prop("-> before >", "x -> y", "operator", "->");
    parse_prop("<< before <", "a << b", "operator", "<<");
    parse_prop("~= before ~", "a ~= b", "operator", "~=");
    parse_prop("chained: a = b -> c = d", "a = b -> c = d", "operator", "=");
    parse_type("implication with equations", "f(x) = x^n -> f'(x) = n*x^(n-1)", "BinaryExpression");
});

describe("SubSuperscript", () => {
    parse_check("x_i^2", "x_i^2", subsup(id("x"), id("i"), num(2)));
    parse_type("(x_i)^2 also produces SubSuperscriptExpression", "(x_i)^2", "SubSuperscriptExpression");
});

describe("Vector name [a]", () => {
    parse_check("[a] produces VectorName", "[a]", vector(id("a")));
    parse_type("[`1T] with skewed id", "[`1T]", "VectorName");
});

describe("Matrix and vector literals", () => {
    parse_type("[a, b, c] row vector", "[a, b, c]", "Matrix");
    parse_type("[[a, b], [c, d]] 2x2 matrix", "[[a, b], [c, d]]", "Matrix");
    parse_type("(a, b, c) is tuple", "(a, b, c)", "Tuple");
    parse_type("(a) is grouping", "(a)", "Identifier");
});

describe("Absolute value", () => {
    parse_check("|x|", "|x|", abs(id("x")));
    parse_prop("|a+b| expr type", "|a+b|", "expr.type", "BinaryExpression");
});

describe("Rollout expressions", () => {
    parse_check("+{k=0, n, A[k]}", "+{k=0, n, A[k]}", control("+", [bin("=", id("k"), num(0)), id("n"), index(id("A"), id("k"))]));
    parse_prop("*{k=0, n, A[k]}", "*{k=0, n, A[k]}", "name", "*");
});

describe("Ellipsis", () => {
    parse_type("...", "...", "Ellipsis");
});

describe("Complex expressions", () => {
    parse_check("polynomial 5x^3+6x+7", "5x^3+6x+7", bin("+",
        bin("+",
            bin("*", num(5), bin("^", id("x"), num(3))),
            bin("*", num(6), id("x")),
        ),
        num(7),
    ));

    parse_check("trig 2\\sin^2(5x+3)", "2\\sin^2(5x+3)", bin("*",
        num(2),
        bin("^", id("sin", "greek"), call(num(2), [bin("+", bin("*", num(5), id("x")), num(3))])),
    ));

    parse_check("trig 2\\sin^2(5x+3)+\\cos(4x)", "2\\sin^2(5x+3)+\\cos(4x)", bin("+",
        bin("*", num(2), bin("^", id("sin", "greek"), call(num(2), [bin("+", bin("*", num(5), id("x")), num(3))]))),
        call(id("cos", "greek"), [bin("*", num(4), id("x"))]),
    ));
});

describe("Parse errors", () => {
    parse_fail("empty input", "", /unexpected/);
    parse_fail("unmatched paren", "(a+b", /unexpected/);
    parse_fail("trailing garbage", "a + @", /unexpected '@'/);
    parse_fail("simple incorrect equation", "2x+", /unexpected 'EOF'/);
    parse_fail("unfinished braces", "\\int{", /unexpected 'EOF'/);
    parse_fail("wrong function syntax", "3+@", /unexpected '@'/);
    parse_fail("error has position info", "3+@", /-->/);
    parse_fail("trailing text after expression", "3+5 hello", /unexpected/);
    parse_fail("double plus operator", "2++5", /unexpected/);
    parse_fail("space before plain identifier blocks implicit mult", "5 x", /unexpected/);
});

describe("Implicit multiplication boundaries", () => {
    parse_check("number * plain identifier (adjacent)", "2x", bin("*", num(2), id("x")));
    parse_check("adjacent identifiers", "xy", bin("*", id("x"), id("y")));
    parse_check("number * greek identifier (adjacent)", "2\\pi", bin("*", num(2), id("pi", "greek")));
    parse_check("number * parenthesized group", "2(x+1)", call(num(2), [bin("+", id("x"), num(1))]));
    parse_check("postfix call then adjacent call", "f(x)g(y)", bin("*", call(id("f"), [id("x")]), call(id("g"), [id("y")])));
});
