export const learningRegistry = {
  "regular-polygon": { name: "Figuras regulares", width: 1000, height: 680, data: { sides: 6, sideLength: 4, unit: "cm" } },
  percentage: { name: "Porcentajes y proporciones", width: 1100, height: 720, data: { part: 25, whole: 100, quantity: 200, task: "portion" } },
  divisibility: { name: "MCD y MCM", width: 1100, height: 720, data: { a: 12, b: 18, task: "gcd" } },
  angle: { name: "Ángulos", width: 1100, height: 720, data: { degrees: 60 } },
  circle: { name: "Círculos", width: 1100, height: 720, data: { radius: 3, task: "area" } },
  statistics: { name: "Estadística visual", width: 1100, height: 720, data: { values: [2, 3, 3, 4, 8], task: "mean" } },
  probability: { name: "Probabilidad", width: 1100, height: 720, data: { experiment: "dice", outcomes: 6, favorable: 2, trials: 60, seed: 1729 } },
  "algebra-tiles": { name: "Álgebra con piezas", width: 1100, height: 720, data: { a: 2, b: 3, c: 0, d: 11 } },
  "powers-roots": { name: "Potencias y raíces", width: 1100, height: 720, data: { base: 4, exponent: 2, task: "power" } },
  measurement: { name: "Medidas y conversiones", width: 1100, height: 720, data: { value: 2, from: "m", to: "cm" } },
} as const;
export const learningIcons = { "regular-polygon": "⬡", percentage: "%", divisibility: "∩", angle: "∠", circle: "◯", statistics: "▥", probability: "⚄", "algebra-tiles": "x+", "powers-roots": "√", measurement: "↔u" };
