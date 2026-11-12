/*! @license
The MIT License (MIT)

Copyright (c) Mathigon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/**
 * Adapted from Mathigon's MIT-licensed Euclid.js and Fermat.js.
 * Copyright (c) Mathigon. Full license: public/notices/mathigon.txt.
 * Provenance and modifications: docs/architecture/mathigon-modules.md.
 */
export type Vertex = { x: number; y: number };
// Adapted from Polygon.signedArea and Polygon.circumference (Euclid.js).
export function signedPolygonArea(points: Vertex[]) {
  const n = points.length;
  let area = points[n - 1]!.x * points[0]!.y - points[0]!.x * points[n - 1]!.y;
  for (let i = 1; i < n; i++) area += points[i - 1]!.x * points[i]!.y - points[i]!.x * points[i - 1]!.y;
  return area / 2;
}
export function polygonPerimeter(points: Vertex[]) {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}
// Adapted from isPrime and primeFactorisation (Fermat.js).
export function isPrime(n: number) {
  if (n % 1 !== 0 || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  const m = Math.sqrt(n);
  for (let i = 5; i <= m; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}
export function primeFactorisation(n: number): number[] {
  if (n === 1) return [];
  if (isPrime(n)) return [n];
  const max = Math.sqrt(n);
  for (let f = 2; f <= max; f++) if (n % f === 0) return primeFactorisation(f).concat(primeFactorisation(n / f));
  return [];
}
// Further adaptations from Fermat number-theory/statistics and Euclid angle/circle.
export function commonDivisor(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const commonMultiple = (a: number, b: number) => Math.abs(a * b) / commonDivisor(a, b);
export const meanValue = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export function medianValue(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) / 2;
  return Number.isInteger(index) ? sorted[index]! : (sorted[Math.floor(index)]! + sorted[Math.ceil(index)]!) / 2;
}
export const circleArea = (radius: number) => Math.PI * radius ** 2;
export const circleCircumference = (radius: number) => 2 * Math.PI * radius;
export const toRadians = (degrees: number) => degrees * Math.PI / 180;
