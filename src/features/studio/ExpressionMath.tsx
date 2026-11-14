import type { ReactNode } from "react";
import { parseExpression, type Expr } from "../../core/scene/expression";
import { superscriptPowers } from "../../core/math-engine/math-notation";

/** Native semantic notation also survives print/PDF without scripts or external fonts. */
export function ExpressionMath({ source }: { source: string }) {
  function draw(e: Expr, parent = 0): ReactNode {
    if (e.kind === "number") return e.value === Math.PI ? "π" : e.value === Math.E ? "e" : String(e.value).replace("-", "−");
    if (e.kind === "variable") return <var>{e.name}</var>;
    if (e.kind === "call") return e.name === "sqrt" ? <span className="st-math-root">√<span>{draw(e.argument)}</span></span> : e.name === "exp" ? <>e<sup>{draw(e.argument)}</sup></> : <>{e.name}({draw(e.argument)})</>;
    const priority = e.op === "+" || e.op === "-" ? 1 : e.op === "^" ? 3 : 2;
    let body: ReactNode;
    if (e.op === "^") body = <>{draw(e.left, 4)}<sup>{draw(e.right)}</sup></>;
    else if (e.op === "/") body = <span className="st-math-fraction"><span>{draw(e.left)}</span><span>{draw(e.right)}</span></span>;
    else body = <>{draw(e.left, priority)}{e.op === "*" ? " · " : e.op === "-" ? " − " : " + "}{draw(e.right, priority + (e.op === "-" ? 1 : 0))}</>;
    return priority < parent && e.op !== "/" ? <>({body})</> : body;
  }
  let expression: Expr;
  try { expression = parseExpression(source); }
  catch { return <span>{superscriptPowers(source)}</span>; }
  return <span role="math" className="st-math-expression">{draw(expression)}</span>;
}

export function MathText({ children }: { children: string }) { return <>{superscriptPowers(children)}</>; }
