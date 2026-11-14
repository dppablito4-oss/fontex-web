export type BooleanScope = Record<string, number | boolean>;
type Node =
  | { op: "value"; value: boolean }
  | { op: "variable"; name: string }
  | { op: "!"; child: Node }
  | { op: "&&" | "||" | "->" | "<->"; left: Node; right: Node };
/** Small, bounded propositional grammar; never executes JavaScript. */
export function logic(source: string) {
  if (!source.trim() || source.length > 300) {
    throw Error("Usa una expresión lógica de hasta 300 caracteres.");
  }
  const text = source.replace(/↔/g, "<->").replace(/→/g, "->").replace(
    /∧/g,
    "&&",
  ).replace(/∨/g, "||").replace(/[¬~]/g, "!");
  const tokens: string[] = [];
  let position = 0;
  while (position < text.length) {
    if (/\s/.test(text[position]!)) {
      position++;
      continue;
    }
    const match = /^(<->|->|&&|\|\||[!()]|[01]|[a-z][a-z0-9_]*)/.exec(
      text.slice(position),
    );
    if (!match) throw Error("Conectivo no admitido. Usa !, &&, ||, -> o <->.");
    tokens.push(match[0]);
    position += match[0].length;
    if (tokens.length > 96) throw Error("Expresión lógica demasiado compleja.");
  }
  let cursor = 0;
  const names = new Set<string>();
  const precedence: Record<string, number> = {
    "<->": 1,
    "->": 2,
    "||": 3,
    "&&": 4,
  };
  function parse(minimum = 1, depth = 0): Node {
    if (depth > 24) throw Error("Expresión lógica demasiado anidada.");
    const token = tokens[cursor++];
    let left: Node;
    if (token === "!") left = { op: "!", child: parse(5, depth + 1) };
    else if (token === "(") {
      left = parse(1, depth + 1);
      if (tokens[cursor++] !== ")") {
        throw Error("Falta cerrar un paréntesis lógico.");
      }
    } else if (token === "0" || token === "false") {
      left = { op: "value", value: false };
    } else if (token === "1" || token === "true") {
      left = { op: "value", value: true };
    } else if (token && /^[a-z][a-z0-9_]{0,31}$/.test(token)) {
      names.add(token);
      left = { op: "variable", name: token };
    } else throw Error("Falta una proposición.");
    while (cursor < tokens.length) {
      const op = tokens[cursor]!, priority = precedence[op] ?? 0;
      if (priority < minimum) break;
      cursor++;
      const right = parse(op === "->" ? priority : priority + 1, depth + 1);
      left = { op: op as "&&" | "||" | "->" | "<->", left, right };
    }
    return left;
  }
  const tree = parse();
  if (cursor !== tokens.length || names.size > 4) {
    throw Error("Revisa la expresión: máximo cuatro proposiciones.");
  }
  function evaluate(node: Node, scope: BooleanScope): boolean {
    if (node.op === "value") return node.value;
    if (node.op === "variable") {
      const value = scope[node.name];
      if (![0, 1, false, true].includes(value!)) {
        throw Error(`La proposición ${node.name} requiere 0 o 1.`);
      }
      return Boolean(value);
    }
    if (node.op === "!") return !evaluate(node.child, scope);
    const a = evaluate(node.left, scope), b = evaluate(node.right, scope);
    return node.op === "&&"
      ? a && b
      : node.op === "||"
      ? a || b
      : node.op === "->"
      ? !a || b
      : a === b;
  }
  return {
    variables: [...names],
    evaluate: (scope: BooleanScope) => evaluate(tree, scope),
  };
}
export function truthTable(source: string, variables: string[]) {
  if (
    variables.length < 1 || variables.length > 4 ||
    new Set(variables).size !== variables.length ||
    variables.some((n) =>
      !/^[a-z][a-z0-9_]{0,31}$/.test(n) || ["true", "false"].includes(n)
    )
  ) throw Error("La tabla admite de una a cuatro proposiciones distintas.");
  const compiled = logic(source);
  if (compiled.variables.some((name) => !variables.includes(name))) {
    throw Error("La expresión usa una proposición que no está en la tabla.");
  }
  return Array.from({ length: 2 ** variables.length }, (_, row) => {
    const assignment = Object.fromEntries(
      variables.map((
        name,
        index,
      ) => [name, (row >> (variables.length - index - 1)) & 1]),
    );
    return { assignment, result: compiled.evaluate(assignment) };
  });
}
export type GraphNode = {
  id: string;
  label: string;
  type: "relation" | "input" | "and" | "or" | "not" | "output";
  variableName: string | null;
  x: number;
  y: number;
};
export type GraphEdge = { from: string; to: string; label: string };
export function graphValues(
  nodes: GraphNode[],
  edges: GraphEdge[],
  scope: BooleanScope,
): Record<string, boolean> {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length || nodes.length > 32 || edges.length > 64) {
    throw Error("Diagrama inválido o demasiado grande.");
  }
  const seenEdges = new Set<string>();
  for (const e of edges) {
    const key = `${e.from}:${e.to}`;
    if (!ids.has(e.from) || !ids.has(e.to) || seenEdges.has(key)) {
      throw Error("Conexión repetida o sin nodo de destino/origen.");
    }
    seenEdges.add(key);
  }
  const result: Record<string, boolean> = Object.create(null) as Record<
    string,
    boolean
  >;
  const visiting = new Set<string>();
  function value(id: string): boolean {
    if (Object.hasOwn(result, id)) return result[id]!;
    if (visiting.has(id)) {
      throw Error("Un circuito lógico no puede contener ciclos.");
    }
    visiting.add(id);
    const node = nodes.find((n) => n.id === id)!;
    const incoming = edges.filter((e) => e.to === id);
    let state: boolean;
    if (node.type === "input") {
      if (
        incoming.length || !node.variableName ||
        ![0, 1, false, true].includes(scope[node.variableName]!)
      ) {
        throw Error(
          "Cada entrada necesita una variable booleana y ninguna conexión entrante.",
        );
      }
      state = Boolean(scope[node.variableName]);
    } else {
      const arity = node.type === "and" || node.type === "or"
        ? incoming.length >= 2 && incoming.length <= 4
        : incoming.length === 1;
      if (node.type === "relation" || !arity) {
        throw Error("AND/OR necesitan de 2 a 4 entradas; NOT y salida, una.");
      }
      const values = incoming.map((e) => value(e.from));
      state = node.type === "and"
        ? values.every(Boolean)
        : node.type === "or"
        ? values.some(Boolean)
        : node.type === "not"
        ? !values[0]
        : values[0]!;
    }
    visiting.delete(id);
    result[id] = state;
    return state;
  }
  nodes.forEach((node) => value(node.id));
  return result;
}
