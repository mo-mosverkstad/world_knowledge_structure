import React from "react";
import ReactDOM from "react-dom/client";
import {AbstractParser} from "./parser/AbstractParser.ts";
import {mathSyntaxPlugin} from "./syntax-plugins/math"

ReactDOM.createRoot(document.getElementById("app")!).render(<div>Tsx component</div>);
console.log(<div>Tsx component</div>);

console.log("5x^3+6x+7", JSON.stringify(mathSyntaxPlugin.parse("5x^3+6x+7")));
console.log("2\\sin^2(5x+3)", JSON.stringify(mathSyntaxPlugin.parse("2\\sin^2(5x+3)")))
console.log("2\\sin^2(5x+3)+\\cos(4x)", JSON.stringify(mathSyntaxPlugin.parse("2\\sin^2(5x+3)+\\cos(4x)")))
// console.log("2x+", JSON.stringify(mathSyntaxPlugin.parse("2x+")))
// console.log("\\int{", JSON.stringify(mathSyntaxPlugin.parse("\\int{")))
//console.log("3+5 hello", JSON.stringify(mathSyntaxPlugin.parse("3+5 hello"))) // Must fail, but does not fail
// console.log("3+@", JSON.stringify(mathSyntaxPlugin.parse("3+@")))
console.log("2++5", JSON.stringify(mathSyntaxPlugin.parse("2++5"))) // Must also fail, but doesn't