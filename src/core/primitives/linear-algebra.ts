export type Matrix = number[][];
export function checkMatrix(matrix: Matrix): number {
  const n = matrix.length;
  if (
    ![2, 3].includes(n) || matrix.some((row) =>
      row.length !== n ||
      row.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e9)
    )
  ) {
    throw Error(
      "Usa una matriz cuadrada 2×2 o 3×3 con valores finitos acotados.",
    );
  }
  return n;
}
export function determinant(matrix: Matrix): number {
  checkMatrix(matrix);
  const a = matrix[0]!, b = matrix[1]!;
  if (matrix.length === 2) return a[0]! * b[1]! - a[1]! * b[0]!;
  const c = matrix[2]!;
  return a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
    a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
    a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!);
}
export function inverse(matrix: Matrix): Matrix | null {
  const n = checkMatrix(matrix),
    augmented = matrix.map((
      row,
      i,
    ) => [...row, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
  const scale = Math.max(...matrix.flat().map(Math.abs));
  if (scale === 0) return null;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row]![col]!) > Math.abs(augmented[pivot]![col]!)) {
        pivot = row;
      }
    }
    if (Math.abs(augmented[pivot]![col]!) <= scale * 1e-12) return null;
    [augmented[col], augmented[pivot]] = [augmented[pivot]!, augmented[col]!];
    const divisor = augmented[col]![col]!;
    augmented[col] = augmented[col]!.map((x) => x / divisor);
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row]![col]!;
      augmented[row] = augmented[row]!.map((x, j) =>
        x - factor * augmented[col]![j]!
      );
    }
  }
  const result = augmented.map((row) => row.slice(n));
  return result.flat().every(Number.isFinite) ? result : null;
}
export function transformPoint(
  matrix: Matrix,
  [x, y]: [number, number],
): [number, number] {
  if (checkMatrix(matrix) !== 2) {
    throw Error("Las transformaciones del plano necesitan una matriz 2×2.");
  }
  return [
    matrix[0]![0]! * x + matrix[0]![1]! * y,
    matrix[1]![0]! * x + matrix[1]![1]! * y,
  ];
}
