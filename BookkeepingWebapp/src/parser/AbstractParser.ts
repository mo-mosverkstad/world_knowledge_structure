import type {
    Syntax,
    PEGExpression,
    PEGParserOptions,
    MatchResult,
    ParseErrorInfo,
    LiteralExpression,
    RegexExpression,
    SequenceExpression,
    ChoiceExpression,
    RepeatExpression,
} from "./types";

export class AbstractParser {
    private syntax: Syntax;
    private skipPattern?: RegExp;
    private inputString: string = "";
    private lineStarts: number[] = [];
    private bestError: ParseErrorInfo = {
        position: 0,
        expected: new Set(),
        found: null,
    };

    constructor(syntax: Syntax, options: PEGParserOptions = {}) {
        this.syntax = syntax;
        this.skipPattern = options.skip;
    }

    parse(startRule: string, inputString: string): unknown {
        this.inputString = inputString;
        this.lineStarts = this.computeLineStarts(inputString);
        this.bestError = { position: 0, expected: new Set(), found: null };

        const result = this.matchRule(startRule, 0);
        if (!result.success) throw new Error(this.formatError());

        const finalPosition = this.skip(result.position);
        if (finalPosition < inputString.length) {
            this.recordFailure(result.position, "EOF");
            throw new Error(this.formatError());
        }
        return result.node;
    }

    private computeLineStarts(s: string): number[] {
        const starts = [0];
        for (let i = 0; i < s.length; i++)
            if (s[i] === "\n") starts.push(i + 1);
        return starts;
    }

    private getLineColumn(position: number): { line: number; column: number } {
        let line = 0;
        while (
            line + 1 < this.lineStarts.length &&
            this.lineStarts[line + 1] <= position
        )
            line++;
        return { line: line + 1, column: position - this.lineStarts[line] + 1 };
    }

    private getLineText(lineNumber: number): string {
        return this.inputString.split("\n")[lineNumber - 1] || "";
    }

    private recordFailure(position: number, expected: string): void {
        if (position > this.bestError.position) {
            this.bestError = {
                position,
                expected: new Set([expected]),
                found: this.inputString[position] || "EOF",
            };
        } else if (position === this.bestError.position) {
            this.bestError.expected.add(expected);
        }
    }

    private formatErrorAtPosition(position: number, message: string): string {
        const { line, column } = this.getLineColumn(position);
        const lineText = this.getLineText(line);
        const caretLine = " ".repeat(column - 1) + "^";
        return [
            `error: ${message}`,
            ` --> inputString:${line}:${column}`,
            `  |`,
            `${line} | ${lineText}`,
            `  | ${caretLine}`,
        ].join("\n");
    }

    private formatError(): string {
        const error = this.bestError;
        const expected = [...error.expected].join(", ");
        return this.formatErrorAtPosition(
            error.position,
            `unexpected '${error.found}'\n  = expected: ${expected}`,
        );
    }

    private matchRule(ruleName: string, position: number): MatchResult {
        const rule = this.syntax[ruleName];
        if (!rule)
            throw new Error(
                this.formatErrorAtPosition(
                    position,
                    `unknown rule: ${ruleName}`,
                ),
            );
        const result = this.match(rule.peg, position);
        if (!result.success) return result;
        const node = rule.build ? rule.build(result.node) : result.node;
        return { success: true, position: result.position, node };
    }

    private match(expr: PEGExpression, position: number): MatchResult<any> {
        switch (expr.type) {
            case "literal":
                return this.matchLiteral(expr, position);
            case "regex":
                return this.matchRegex(expr, position);
            case "sequence":
                return this.matchSequence(expr, position);
            case "choice":
                return this.matchChoice(expr, position);
            case "repeat":
                return this.matchRepeat(expr, position);
            case "rule":
                return this.matchRule(expr.name, position);
            default:
                throw new Error(
                    this.formatErrorAtPosition(
                        position,
                        `unknown PEG node type: ${(expr as any).type}`,
                    ),
                );
        }
    }

    private matchLiteral(
        expr: LiteralExpression,
        position: number,
    ): MatchResult<string> {
        position = this.skip(position);
        if (this.inputString.startsWith(expr.value, position))
            return {
                success: true,
                position: position + expr.value.length,
                node: expr.value,
            };
        this.recordFailure(position, `"${expr.value}"`);
        return { success: false, position };
    }

    private matchRegex(
        expr: RegexExpression,
        position: number,
    ): MatchResult<string> {
        position = this.skip(position);
        const slice = this.inputString.slice(position);
        const match = slice.match(expr.regex);
        if (!match || match.index !== 0) {
            this.recordFailure(position, expr.name || "pattern");
            return { success: false, position };
        }
        return {
            success: true,
            position: position + match[0].length,
            node: match[0],
        };
    }

    private matchSequence(
        expr: SequenceExpression,
        position: number,
    ): MatchResult<any[]> {
        const values: any[] = [];
        let current = position;
        for (const part of expr.parts) {
            const result = this.match(part, current);
            if (!result.success) return result;
            values.push(result.node);
            current = result.position;
        }
        return { success: true, position: current, node: values };
    }

    private matchChoice(expr: ChoiceExpression, position: number): MatchResult {
        for (const option of expr.options) {
            const result = this.match(option, position);
            if (result.success) return result;
        }
        return { success: false, position };
    }

    private matchRepeat(
        expr: RepeatExpression,
        position: number,
    ): MatchResult<any[]> {
        const values: any[] = [];
        let current = position;
        while (true) {
            const result = this.match(expr.expr, current);
            if (!result.success || result.position === current) break;
            values.push(result.node);
            current = result.position;
        }
        return { success: true, position: current, node: values };
    }

    private skip(position: number): number {
        if (!this.skipPattern) return position;
        while (position < this.inputString.length) {
            const slice = this.inputString.slice(position);
            this.skipPattern.lastIndex = 0;
            const match = this.skipPattern.exec(slice);
            if (!match || match.index !== 0 || match[0].length === 0) break;
            position += match[0].length;
        }
        return position;
    }
}
