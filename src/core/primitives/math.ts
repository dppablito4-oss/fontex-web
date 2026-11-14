import {
  derivative,
  evaluate,
  type Expr,
  parseExpression,
} from "../scene/expression.ts";
import type { Primitive, PrimitiveScene } from "./schema.ts";
import {
  checkMatrix,
  determinant,
  inverse,
  type Matrix,
} from "./linear-algebra.ts";
const matricesKey = Symbol("fontex.matrices");
export type Scope = Record<string, number> & {
  [matricesKey]?: Record<string, Matrix>;
};
export function scopeMatrix(scope: Scope, name: string): Matrix {
  const matrix = scope[matricesKey]?.[name];
  if (!matrix) throw Error(`Matriz no definida: ${name}`);
  return matrix;
}
function matrixCalls(source: string, scope: Scope) {
  return source.replace(
    /\b(det|inv)\(\s*([a-z][a-z0-9_]*)\s*(?:,\s*([1-3])\s*,\s*([1-3])\s*)?\)/g,
    (
      _match: string,
      operation: string,
      name: string,
      row?: string,
      col?: string,
    ) => {
      const matrix = scopeMatrix(scope, name);
      if (operation === "det") {
        if (row) throw Error("det recibe sólo el nombre de la matriz.");
        return `(${determinant(matrix)})`;
      }
      if (!row || !col) {
        throw Error(
          "inv(m) es una matriz; usa inv(m,fila,columna) en una expresión escalar.",
        );
      }
      const value = inverse(matrix)?.[Number(row) - 1]?.[Number(col) - 1];
      if (value === undefined) {
        throw Error("Matriz singular o índice fuera de rango.");
      }
      return `(${value})`;
    },
  );
}
export type FunctionDefinition = { source: string; angleUnit: "rad" | "deg" };
export const baseFunctions = new Set([
  "sin",
  "cos",
  "tan",
  "ln",
  "exp",
  "sqrt",
]);
export const helperFunctions = new Set([
  "round",
  "abs",
  "deg",
  "rad",
  "floor",
  "ceil",
  "min",
  "max",
  "gcd",
  "lcm",
  "atan2",
]);
export const reservedNames = new Set([
  "x",
  "pi",
  "e",
  ...baseFunctions,
  ...helperFunctions,
  "factors",
  "det",
  "inv",
]);
export const displayNumber = (n: number) =>
  Number.isFinite(n)
    ? String(Object.is(n, -0) ? 0 : Number(n.toPrecision(8)))
    : "No definido";
function substitute(source: string, scope: Scope) {
  return source.replace(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z_][a-z0-9_]*/gi,
    (token) => {
      if (
        /^[\d.]/.test(token) || token === "x" || token === "pi" ||
        token === "e" || baseFunctions.has(token)
      ) return token;
      if (
        !Object.hasOwn(scope, token) || !Number.isFinite(scope[token])
      ) throw new Error(`Variable no definida: ${token}`);
      return `(${scope[token]})`;
    },
  );
}
function convertAngles(e: Expr, degrees: boolean): Expr {
  if (e.kind === "binary") {
    return {
      ...e,
      left: convertAngles(e.left, degrees),
      right: convertAngles(e.right, degrees),
    };
  }
  if (e.kind !== "call") return e;
  const argument = convertAngles(e.argument, degrees);
  return {
    ...e,
    argument: degrees && ["sin", "cos", "tan"].includes(e.name)
      ? {
        kind: "binary",
        op: "*",
        left: argument,
        right: { kind: "number", value: Math.PI / 180 },
      }
      : argument,
  };
}
export function compile(
  source: string,
  scope: Scope,
  unit: "rad" | "deg" = "rad",
) {
  if (source.length > 500) {
    throw new Error("La expresión supera 500 caracteres.");
  }
  const expression = convertAngles(
    parseExpression(substitute(matrixCalls(source, scope), scope)),
    unit === "deg",
  );
  const derived = derivative(expression);
  const value = (x: number) => evaluate(expression, x, { a: 0, b: 0, c: 0 });
  const slope = (x: number) =>
    Number.isFinite(value(x))
      ? evaluate(derived, x, { a: 0, b: 0, c: 0 })
      : NaN;
  return { expression, derived, value, slope };
}
export function scalar(
  source: string,
  scope: Scope,
  functions: Record<string, FunctionDefinition> = {},
  depth = 0,
): number {
  if (depth > 16 || source.length > 500) {
    throw Error("Expresión demasiado compleja.");
  }
  const text = matrixCalls(source, scope),
    pattern = /\b([a-z_][a-z0-9_]*)\s*\(/g;
  let output = "", previous = 0, match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const name = match[1]!;
    if (
      !baseFunctions.has(name) && !helperFunctions.has(name) &&
      !Object.hasOwn(functions, name)
    ) throw Error(`Función no admitida: ${name}`);
    const begin = pattern.lastIndex;
    let end = begin, nesting = 1;
    for (; end < text.length && nesting; end++) {
      if (text[end] === "(") nesting++;
      if (text[end] === ")") nesting--;
      if (nesting > 24) throw Error("Expresión demasiado anidada.");
    }
    if (nesting) throw Error("Falta cerrar una función.");
    const inner = text.slice(begin, end - 1), args: string[] = [];
    let start = 0, level = 0;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") level++;
      if (inner[i] === ")") level--;
      if (inner[i] === "," && !level) {
        args.push(inner.slice(start, i));
        start = i + 1;
      }
    }
    args.push(inner.slice(start));
    const arity = ["round", "min", "max", "gcd", "lcm", "atan2"].includes(name)
      ? 2
      : 1;
    if (args.length !== arity) throw Error(`Revisa los argumentos de ${name}.`);
    const values = args.map((arg) => scalar(arg, scope, functions, depth + 1)),
      a = values[0]!,
      b = values[1] ?? 0;
    let result: number;
    if (baseFunctions.has(name)) {
      result = compile(`${name}(${a})`, scope).value(0);
    } else if (Object.hasOwn(functions, name)) {
      result = compile(
        functions[name]!.source,
        scope,
        functions[name]!.angleUnit,
      ).value(a);
    } else if (name === "round") {
      if (!Number.isInteger(b) || b < 0 || b > 10) {
        throw Error("Decimales entre 0 y 10.");
      }
      result = Math.round(a * 10 ** b) / 10 ** b;
    } else if (name === "abs") result = Math.abs(a);
    else if (name === "deg") result = a * 180 / Math.PI;
    else if (name === "rad") result = a * Math.PI / 180;
    else if (name === "atan2") result = Math.atan2(a, b);
    else if (name === "floor") result = Math.floor(a);
    else if (name === "ceil") result = Math.ceil(a);
    else if (name === "min") result = Math.min(a, b);
    else if (name === "max") result = Math.max(a, b);
    else {
      if (![a, b].every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1e9)) {
        throw Error("MCD y MCM requieren enteros acotados.");
      }
      let left = Math.abs(a), right = Math.abs(b);
      for (let i = 0; right && i < 128; i++) {
        [left, right] = [right, left % right];
      }
      result = name === "gcd"
        ? left
        : a === 0 || b === 0
        ? 0
        : Math.abs(a / left * b);
    }
    if (!Number.isFinite(result)) {
      throw Error("Valor no definido en este punto.");
    }
    output += text.slice(previous, match.index) + `(${result})`;
    previous = end;
    pattern.lastIndex = end;
  }
  output += text.slice(previous);
  if (/\bx\b/.test(output) && !Object.hasOwn(scope, "x")) {
    throw Error("Esta medida requiere un valor de x.");
  }
  const result = compile(output, scope).value(scope.x ?? 0);
  if (!Number.isFinite(result)) throw Error("Valor no definido.");
  return result;
}
export type Integral = { status: "finite"; value: number; error: number } | {
  status: "undefined" | "nonconvergent";
  message: string;
};
export function integrate(
  f: (x: number) => number,
  from: number,
  to: number,
  area = false,
): Integral {
  if (![from, to].every(Number.isFinite) || Math.abs(to - from) > 20000) {
    return { status: "undefined", message: "Intervalo no válido." };
  }
  if (from === to) return { status: "finite", value: 0, error: 0 };
  const lo = Math.min(from, to), hi = Math.max(from, to);
  function simpson(n: number) {
    const h = (hi - lo) / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const y = f(lo + i * h);
      if (!Number.isFinite(y) || Math.abs(y) > 1e10) return NaN;
      sum += (area ? Math.abs(y) : y) *
        (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
    }
    return sum * h / 3;
  }
  let previous = simpson(200);
  if (!Number.isFinite(previous)) {
    return {
      status: "undefined",
      message: "El intervalo contiene valores no definidos o fuera de escala.",
    };
  }
  for (const n of [400, 800, 1600]) {
    const value = simpson(n), error = Math.abs(value - previous) / 15;
    if (!Number.isFinite(value)) {
      return {
        status: "undefined",
        message: "No se integra a través de una discontinuidad.",
      };
    }
    if (error <= 1e-7 * Math.max(1, Math.abs(value))) {
      return {
        status: "finite",
        value: value * (area || from < to ? 1 : -1),
        error,
      };
    }
    previous = value;
  }
  return {
    status: "nonconvergent",
    message:
      "La aproximación no converge con el presupuesto de cálculo disponible.",
  };
}
export function sample(
  f: (x: number) => number,
  from: number,
  to: number,
  minY: number,
  maxY: number,
  n = 320,
) {
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  const end = () => {
    if (segment.length > 1) segments.push(segment);
    segment = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = from + (to - from) * i / n, y = f(x), last = segment.at(-1);
    if (
      !Number.isFinite(y) || y < minY - (maxY - minY) * .1 ||
      y > maxY + (maxY - minY) * .1
    ) {
      end();
      continue;
    }
    if (last) {
      const mid = f((last.x + x) / 2);
      if (
        !Number.isFinite(mid) || Math.abs(y - last.y) > (maxY - minY) / 2 ||
        mid < minY || mid > maxY
      ) end();
    }
    segment.push({ x, y });
  }
  end();
  return segments;
}
export function userScope(scene: PrimitiveScene): Scope {
  const scope: Scope = Object.fromEntries(
    scene.variables.map((v) => [v.name, v.value]),
  );
  const matrices: Record<string, Matrix> = Object.create(null) as Record<
    string,
    Matrix
  >;
  for (const p of scene.primitives) {
    if (p.kind !== "data_chart" || p.data.chartType !== "matrix") continue;
    if (!p.data.matrixName || !p.data.matrixCells) {
      throw Error("Completa el nombre y las celdas de la matriz.");
    }
    const matrix = p.data.matrixCells.map((row) =>
      row.map((cell) => scalar(cell, scope))
    );
    checkMatrix(matrix);
    matrices[p.data.matrixName] = matrix;
  }
  Object.defineProperty(scope, matricesKey, { value: matrices });
  return scope;
}
export function sceneFunctions(
  scene: PrimitiveScene,
): Record<string, FunctionDefinition> {
  return Object.fromEntries(
    scene.primitives.flatMap((p) =>
      p.kind === "function_region" &&
        (!p.data.curveMode || p.data.curveMode === "cartesian")
        ? [[p.data.name, {
          source: p.data.expression,
          angleUnit: p.data.angleUnit,
        }]]
        : []
    ),
  );
}
export function regionResult(
  p: Extract<Primitive, { kind: "function_region" }>,
  scope: Scope,
) {
  const f = compile(p.data.expression, scope, p.data.angleUnit).value;
  const g = p.data.secondaryExpression
    ? compile(p.data.secondaryExpression, scope, p.data.angleUnit).value
    : () => 0;
  return integrate(
    (x) => f(x) - g(x),
    scalar(p.data.fromExpr, scope),
    scalar(p.data.toExpr, scope),
    p.data.areaMode === "geometric",
  );
}
export function sceneScope(scene: PrimitiveScene): Scope {
  const scope = userScope(scene);
  for (const p of scene.primitives) {
    if (p.kind === "function_region" && p.data.showArea) {
      try {
        const result = regionResult(p, scope);
        if (result.status === "finite") scope[p.data.resultName] = result.value;
      } catch { /* Undefined quantities remain unavailable. */ }
    }
  }
  return scope;
}
export function interpolate(
  text: string,
  scope: Scope,
  functions: Record<string, FunctionDefinition> = {},
) {
  return text.replace(
    /\{\{([^{}]{1,500})\}\}/g,
    (_match: string, source: string) => {
      try {
        const wholeInverse = /^inv\(\s*([a-z][a-z0-9_]*)\s*\)$/.exec(
          source.trim(),
        );
        if (wholeInverse) {
          const matrix = inverse(scopeMatrix(scope, wholeInverse[1]!));
          return matrix
            ? matrix.map((row) => `[${row.map(displayNumber).join(", ")}]`)
              .join(" ")
            : "No definida (matriz singular)";
        }
        const factor = /^factors\((.+)\)$/.exec(source.trim());
        return factor
          ? factors(scalar(factor[1]!, scope, functions))
          : displayNumber(scalar(source, scope, functions));
      } catch {
        return "No definido";
      }
    },
  );
}
/** Keep endpoints and visible bends while bounding serialized freehand data. */
export function simplifyStroke(
  points: [number, number][],
  tolerance = 2,
): [number, number][] {
  if (points.length < 3) return points;
  const first = points[0]!,
    last = points.at(-1)!,
    dx = last[0] - first[0],
    dy = last[1] - first[1];
  let max = tolerance, index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - first[0]) * dx + (p[1] - first[1]) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
    const d = Math.hypot(p[0] - first[0] - t * dx, p[1] - first[1] - t * dy);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  return index < 0 ? [first, last] : [
    ...simplifyStroke(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyStroke(points.slice(index), tolerance),
  ];
}
export function polygonMetrics(points: [number, number][]) {
  if (
    points.length < 3 ||
    new Set(points.map((p) => p.join(","))).size !== points.length
  ) throw Error("El polígono requiere vértices distintos.");
  const cross = (
    a: [number, number],
    b: [number, number],
    c: [number, number],
  ) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const intersects = (
    a: [number, number],
    b: [number, number],
    c: [number, number],
    d: [number, number],
  ) =>
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) &&
    cross(a, b, c) * cross(a, b, d) <= 0 &&
    cross(c, d, a) * cross(c, d, b) <= 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (
        j !== (i + 1) % points.length && i !== (j + 1) % points.length &&
        intersects(
          points[i]!,
          points[(i + 1) % points.length]!,
          points[j]!,
          points[(j + 1) % points.length]!,
        )
      ) {
        throw Error("Los lados del polígono no deben cruzarse.");
      }
    }
  }
  const twice = points.reduce((s, q, i) => {
    const r = points[(i + 1) % points.length]!;
    return s + q[0] * r[1] - q[1] * r[0];
  }, 0);
  if (Math.abs(twice) < 1e-10) {
    throw Error("Los vértices no encierran un área.");
  }
  const sides = points.map((q, i) =>
    Math.hypot(
      q[0] - points[(i + 1) % points.length]![0],
      q[1] - points[(i + 1) % points.length]![1],
    )
  );
  const angles = points.map((q, i) => {
    const prev = points[(i + points.length - 1) % points.length]!,
      next = points[(i + 1) % points.length]!,
      ux = prev[0] - q[0],
      uy = prev[1] - q[1],
      vx = next[0] - q[0],
      vy = next[1] - q[1];
    const angle = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy)),
        ),
      ),
    ) * 180 / Math.PI;
    return (ux * vy - uy * vx) * Math.sign(twice) > 0 ? 360 - angle : angle;
  });
  return {
    area: Math.abs(twice) / 2,
    sides,
    perimeter: sides.reduce((a, b) => a + b, 0),
    angles,
  };
}
export function factors(value: number): string {
  if (!Number.isSafeInteger(value) || value < 2 || value > 1e6) {
    throw Error("Descomposición: entero entre 2 y 1000000.");
  }
  let n = value;
  const out: string[] = [];
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  for (let p = 2; p * p <= n; p++) {
    let count = 0;
    while (n % p === 0) {
      count++;
      n /= p;
    }
    if (count) {
      out.push(
        `${p}${
          count > 1
            ? String(count).split("").map((d) => superscripts[Number(d)]).join(
              "",
            )
            : ""
        }`,
      );
    }
  }
  if (n > 1) out.push(String(n));
  return out.join(" · ");
}
/** Build bounded contours without connecting across sampled holes or large jumps. */
export function shadeContours(
  f: (x: number) => number,
  g: (x: number) => number,
  from: number,
  to: number,
  minY: number,
  maxY: number,
) {
  const result: { x: number; y: number }[][] = [];
  let upper: { x: number; y: number }[] = [],
    lower: { x: number; y: number }[] = [];
  let previous: { x: number; f: number; g: number } | null = null;
  const span = maxY - minY,
    clamp = (y: number) =>
      Math.max(minY - span * .1, Math.min(maxY + span * .1, y));
  const end = () => {
    if (upper.length > 1) result.push([...upper, ...lower.reverse()]);
    upper = [];
    lower = [];
    previous = null;
  };
  for (let i = 0; i <= 200; i++) {
    const x = from + (to - from) * i / 200, a = f(x), b = g(x);
    if (![a, b].every((v) => Number.isFinite(v) && Math.abs(v) < 1e10)) {
      end();
      continue;
    }
    if (previous) {
      const m = (x + previous.x) / 2, fa = f(m), ga = g(m);
      if (
        ![fa, ga].every(Number.isFinite) ||
        (Math.sign(a) !== Math.sign(previous.f) &&
          Math.abs(a - previous.f) > span * 4) ||
        (Math.sign(b) !== Math.sign(previous.g) &&
          Math.abs(b - previous.g) > span * 4)
      ) end();
    }
    upper.push({ x, y: clamp(a) });
    lower.push({ x, y: clamp(b) });
    previous = { x, f: a, g: b };
  }
  end();
  return result;
}
/** Human-readable tick spacing (1, 2, 2.5, 5...) rather than repeating decimals. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const raw = (max - min) / Math.max(2, target),
    power = 10 ** Math.floor(Math.log10(raw));
  const factor = [1, 2, 2.5, 5, 10].find((n) => n * power >= raw) ?? 10,
    step = factor * power;
  const ticks: number[] = [];
  for (
    let index = Math.ceil(min / step);
    index * step <= max + step * 1e-9 && ticks.length < 32;
    index++
  ) ticks.push(Number((index * step).toPrecision(10)));
  return ticks;
}
