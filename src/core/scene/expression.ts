import { normalizePowers } from "../math-engine/math-notation.ts";

export type Expr =
  | { kind: "number"; value: number }
  | { kind: "variable"; name: string }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { kind: "call"; name: string; argument: Expr };
export type Variables = { a: number; b: number; c: number };
const functions = new Set(["sin", "cos", "tan", "exp", "ln", "sqrt"]);
const num = (value: number): Expr => ({ kind: "number", value });
const bin = (
  op: "+" | "-" | "*" | "/" | "^",
  left: Expr,
  right: Expr,
): Expr => ({ kind: "binary", op, left, right });
const call = (name: string, argument: Expr): Expr => ({
  kind: "call",
  name,
  argument,
});
export function parseExpression(source: string): Expr {
  if (!source.trim() || source.length > 500) {
    throw new Error("Escribe una expresión de hasta 500 caracteres.");
  }
  let text = normalizePowers(source).toLowerCase().replace(/π/g, "pi").replace(/×|·/g, "*")
    .replace(/÷/g, "/").replace(/−/g, "-").replace(/\bsen\b/g, "sin").replace(
      /\blog\b/g,
      "ln",
    ).replace(/^\s*(?:y|f\(x\))\s*=/, "");
  if (text.includes("=")) {
    const sides = text.split("=");
    if (sides.length !== 2 || sides.some((s) => !s.trim())) {
      throw new Error("Usa una sola igualdad.");
    }
    text = `(${sides[0]})-(${sides[1]})`;
  }
  const tokens =
    text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[^\s]/g) ?? [];
  if (tokens.length > 250) {
    throw new Error("La expresión es demasiado extensa.");
  }
  let at = 0, depth = 0;
  const peek = () => tokens[at];
  function primary(): Expr {
    if (++depth > 40) throw new Error("Demasiados paréntesis anidados.");
    const token = tokens[at++];
    let result: Expr;
    if (token === "(") {
      result = sum();
      if (tokens[at++] !== ")") throw new Error("Falta cerrar un paréntesis.");
    } else if (token && /^(?:\d|\.)/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error("Número fuera de rango.");
      result = num(value);
    } else if (token === "pi") result = num(Math.PI);
    else if (token === "e") result = num(Math.E);
    else if (token && ["x", "a", "b", "c"].includes(token)) {
      result = { kind: "variable", name: token };
    } else if (token && functions.has(token)) {
      if (tokens[at++] !== "(") throw new Error(`Usa ${token}(…).`);
      result = call(token, sum());
      if (tokens[at++] !== ")") throw new Error("Falta cerrar la función.");
    } else {throw new Error(
        `Símbolo no admitido: ${
          token ?? "fin de expresión"
        }. Usa x, a, b, c, sin, cos, tan, exp, ln o sqrt.`,
      );}
    depth--;
    return result;
  }
  function power(): Expr {
    const left = primary();
    return peek() === "^" ? (at++, bin("^", left, unary())) : left;
  }
  function unary(): Expr {
    if (peek() === "+") {
      at++;
      return unary();
    }
    if (peek() === "-") {
      at++;
      return bin("*", num(-1), unary());
    }
    return power();
  }
  function product(): Expr {
    let left = unary();
    while (
      peek() === "*" || peek() === "/" || !!peek()?.match(/^(?:[a-z]+|\()$/)
    ) {
      const op = peek() === "/" ? "/" : "*";
      if (peek() === "*" || peek() === "/") at++;
      left = bin(op, left, unary());
    }
    return left;
  }
  function sum(): Expr {
    let left = product();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[at++] as "+" | "-";
      left = bin(op, left, product());
    }
    return left;
  }
  const result = sum();
  if (at !== tokens.length) throw new Error(`Revisa el símbolo «${peek()}».`);
  return result;
}
export function evaluate(expr: Expr, x: number, variables: Variables): number {
  if (expr.kind === "number") return expr.value;
  if (expr.kind === "variable") {
    return expr.name === "x" ? x : variables[expr.name as keyof Variables];
  }
  if (expr.kind === "call") {
    const a = evaluate(expr.argument, x, variables);
    switch (expr.name) {
      case "sin":
        return Math.sin(a);
      case "cos":
        return Math.cos(a);
      case "tan":
        return Math.abs(Math.cos(a)) < 1e-12 ? NaN : Math.tan(a);
      case "ln":
        return Math.log(a);
      case "sqrt":
        return Math.sqrt(a);
      case "exp":
        return Math.exp(a);
    }
    return NaN;
  }
  const l = evaluate(expr.left, x, variables),
    r = evaluate(expr.right, x, variables);
  switch (expr.op) {
    case "+":
      return l + r;
    case "-":
      return l - r;
    case "*":
      return l * r;
    case "/":
      return r === 0 ? NaN : l / r;
    case "^":
      return l ** r;
  }
}
export function simplify(e: Expr): Expr {
  if (e.kind === "call") return call(e.name, simplify(e.argument));
  if (e.kind !== "binary") return e;
  const l = simplify(e.left), r = simplify(e.right);
  if (l.kind === "number" && r.kind === "number") {
    const v = evaluate(bin(e.op, l, r), 0, { a: 1, b: 0, c: 0 });
    if (Number.isFinite(v)) return num(v);
  }
  const is = (n: Expr, v: number) => n.kind === "number" && n.value === v;
  if (e.op === "+" && is(l, 0)) return r;
  if ((e.op === "+" || e.op === "-") && is(r, 0)) return l;
  if (e.op === "*" && (is(l, 0) || is(r, 0))) return num(0);
  if (e.op === "*" && is(l, 1)) return r;
  if ((e.op === "*" || e.op === "/" || e.op === "^") && is(r, 1)) return l;
  if (e.op === "^" && is(r, 0)) return num(1);
  return bin(e.op, l, r);
}
function dependsOnX(e: Expr): boolean {
  if (e.kind === "variable") return e.name === "x";
  if (e.kind === "number") return false;
  if (e.kind === "call") return dependsOnX(e.argument);
  return dependsOnX(e.left) || dependsOnX(e.right);
}
export function derivative(e: Expr, variables?: Variables): Expr {
  function parameters(n: Expr): Expr {
    if (n.kind === "variable" && n.name !== "x" && variables) return num(variables[n.name as keyof Variables]);
    if (n.kind === "binary") return bin(n.op, parameters(n.left), parameters(n.right));
    if (n.kind === "call") return call(n.name, parameters(n.argument));
    return n;
  }
  function d(n: Expr): Expr {
    if (n.kind === "number") return num(0);
    if (n.kind === "variable") return num(n.name === "x" ? 1 : 0);
    if (n.kind === "call") {
      const u = n.argument, du = d(u);
      const outer = n.name === "sin"
        ? call("cos", u)
        : n.name === "cos"
        ? bin("*", num(-1), call("sin", u))
        : n.name === "tan"
        ? bin("/", num(1), bin("^", call("cos", u), num(2)))
        : n.name === "exp"
        ? call("exp", u)
        : n.name === "ln"
        ? bin("/", num(1), u)
        : bin("/", num(1), bin("*", num(2), call("sqrt", u)));
      return bin("*", outer, du);
    }
    const u = n.left, v = n.right, du = d(u), dv = d(v);
    if (n.op === "+" || n.op === "-") return bin(n.op, du, dv);
    if (n.op === "*") return bin("+", bin("*", du, v), bin("*", u, dv));
    if (n.op === "/") {
      return bin(
        "/",
        bin("-", bin("*", du, v), bin("*", u, dv)),
        bin("^", v, num(2)),
      );
    }
    if (!dependsOnX(v)) {
      return bin("*", bin("*", v, bin("^", u, bin("-", v, num(1)))), du);
    }
    return bin(
      "*",
      bin("^", u, v),
      bin("+", bin("*", dv, call("ln", u)), bin("*", v, bin("/", du, u))),
    );
  }
  return simplify(d(simplify(parameters(e))));
}
export function expressionText(e: Expr): string {
  if (e.kind === "number") {
    return Number.isInteger(e.value)
      ? String(e.value)
      : String(Number(e.value.toPrecision(6)));
  }
  if (e.kind === "variable") return e.name;
  if (e.kind === "call") return `${e.name}(${expressionText(e.argument)})`;
  return `(${expressionText(e.left)} ${e.op} ${expressionText(e.right)})`;
}
export function polynomial(e: Expr, vars: Variables): number[] | null {
  const trim = (p: number[]) => {
    while (p.length > 1 && p.at(-1) === 0) p.pop();
    return p;
  };
  function p(n: Expr): number[] | null {
    if (n.kind === "number") return [n.value];
    if (n.kind === "variable") {
      return n.name === "x" ? [0, 1] : [vars[n.name as keyof Variables]];
    }
    if (n.kind !== "binary") return null;
    const l = p(n.left), r = p(n.right);
    if (!l || !r) return null;
    if (n.op === "+" || n.op === "-") {
      return trim(
        Array.from(
          { length: Math.max(l.length, r.length) },
          (_, i) => (l[i] ?? 0) + (n.op === "+" ? 1 : -1) * (r[i] ?? 0),
        ),
      );
    }
    if (n.op === "/") {
      return r.length === 1 && r[0] !== 0 ? l.map((v) => v / r[0]!) : null;
    }
    const multiply = (a: number[], b: number[]) => {
      const out = Array<number>(a.length + b.length - 1).fill(0);
      a.forEach((v, i) =>
        b.forEach((w, j) => {
          out[i + j]! += v * w;
        })
      );
      return trim(out);
    };
    if (n.op === "*") return l.length + r.length > 6 ? null : multiply(l, r);
    if (r.length !== 1 || !Number.isInteger(r[0]) || r[0]! < 0 || r[0]! > 4) {
      return null;
    }
    let out = [1];
    for (let i = 0; i < r[0]!; i++) {
      out = multiply(out, l);
      if (out.length > 5) return null;
    }
    return out;
  }
  const result = p(e);
  return result && result.length <= 5 && result.every(Number.isFinite)
    ? result
    : null;
}
export function realRoots(coefficients: number[]): number[] {
  if (!coefficients.every(Number.isFinite)) throw new Error("Los coeficientes deben ser finitos.");
  const scale = Math.max(...coefficients.map(Math.abs));
  if (!scale) return [];
  const p = coefficients.map(c => c / scale);
  while (p.length > 1 && p.at(-1) === 0) p.pop();
  if (p.length <= 1) return [];
  if (p.length === 2) return [-p[0]! / p[1]!];
  const value = (x: number) => p.reduceRight((s, c) => s * x + c, 0);
  const bound = 1 +
    Math.max(...p.slice(0, -1).map((c) => Math.abs(c / p.at(-1)!)));
  if (!Number.isFinite(bound) || bound > 1e6) {
    throw new Error(
      "Las raíces requieren una escala numérica menor para este prototipo.",
    );
  }
  const critical = realRoots(p.slice(1).map((c, i) => c * (i + 1))).filter(
    (x) => x > -bound && x < bound,
  );
  const points = [-bound, ...critical, bound], roots: number[] = [];
  // Bound floating point evaluation error at x, independently of coefficient scale.
  const isRoot = (x: number) => Math.abs(value(x)) <= 64 * Number.EPSILON *
    p.reduceRight((s, c) => s * Math.abs(x) + Math.abs(c), 0);
  for (const x of critical) if (isRoot(x)) roots.push(x);
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]!, b = points[i]!;
    if (isRoot(a) || isRoot(b) || Math.sign(value(a)) === Math.sign(value(b))) continue;
    for (let k = 0; k < 100; k++) {
      const m = (a + b) / 2;
      if (value(m) === 0) { a = b = m; break; }
      if (Math.sign(value(a)) !== Math.sign(value(m))) b = m;
      else a = m;
    }
    roots.push((a + b) / 2);
  }
  return roots.sort((a, b) => a - b).filter((x, i, xs) =>
    i === 0 || Math.abs(x - xs[i - 1]!) > 64 * Number.EPSILON * Math.max(1, Math.abs(x), Math.abs(xs[i - 1]!))
  );
}
