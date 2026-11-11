export type Fraction = { n: number; d: number };
export type Operation = { a: Fraction; b: Fraction; operator: '+' | '-'; denominator: number; left: number; right: number; total: number; simplified: Fraction };
export const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
export function parseOperation(input: string): Operation {
  const match = input.trim().match(/^(\d+)\s*\/\s*(\d+)\s*([+−-])\s*(\d+)\s*\/\s*(\d+)$/);
  if (!match) throw new Error('Escribe dos fracciones con + o −. Por ejemplo: 2/3 + 3/6.');
  const a = { n: Number(match[1]), d: Number(match[2]) };
  const b = { n: Number(match[4]), d: Number(match[5]) };
  if (!a.d || !b.d) throw new Error('El denominador no puede ser cero: indica en cuántas partes divides la unidad.');
  if (a.d > 24 || b.d > 24 || a.n > a.d * 3 || b.n > b.d * 3) throw new Error('Para ver bien las figuras, usa denominadores de 1 a 24 y fracciones de hasta 3 unidades.');
  const denominator = a.d / gcd(a.d, b.d) * b.d;
  if (denominator > 60) throw new Error('Esta operación necesita demasiadas divisiones para el dibujo. Prueba con un denominador común de hasta 60.');
  const left = a.n * (denominator / a.d), right = b.n * (denominator / b.d);
  const operator = match[3] === '+' ? '+' : '-';
  const total = operator === '+' ? left + right : left - right;
  if (total < 0) throw new Error('En este primer lienzo trabajamos con resultados positivos o cero. Pon la fracción mayor primero.');
  const divisor = gcd(total, denominator);
  return { a, b, operator, denominator, left, right, total, simplified: { n: total / divisor, d: denominator / divisor } };
}
