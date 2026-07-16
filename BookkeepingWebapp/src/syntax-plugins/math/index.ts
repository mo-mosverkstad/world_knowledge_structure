import type { MathNode } from "./types";
import { syntaxParser } from "./SyntaxParser.ts";

export const mathSyntaxPlugin: any = {
    type_id: "math",
    parse(text: string): unknown {
        return syntaxParser.parse("Expression", text);
    },
    /*
    render(ast: unknown): HTMLElement {
        //return renderMath(ast as MathNode);
        return null;
    },
    */
};
