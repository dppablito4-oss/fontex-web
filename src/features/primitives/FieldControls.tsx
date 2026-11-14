import { useState } from "react";
export function Text(
  { label, value, onChange, type = "text" }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    type?: string;
  },
) {
  const [draft, setDraft] = useState(value),
    [focused, setFocused] = useState(false);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={focused ? draft : value}
        onFocus={() => {
          setFocused(true);
          setDraft(value);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(value);
        }}
      />
    </label>
  );
}
export function NumberField(
  { label, value, onChange }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
  },
) {
  return (
    <Text
      label={label}
      value={String(value)}
      type="number"
      onChange={(s) => {
        if (s.trim() && Number.isFinite(Number(s))) onChange(Number(s));
      }}
    />
  );
}
export function Toggle(
  { label, value, onChange }: {
    label: string;
    value: boolean;
    onChange: (b: boolean) => void;
  },
) {
  return (
    <label className="pc-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
const optionLabels: Record<string, string> = {
  relations: "Relaciones y árboles",
  logic: "Circuito lógico",
  input: "Entrada",
  and: "AND · Serie",
  or: "OR · Paralelo",
  not: "NOT · Negación",
  output: "Salida",
  relation: "Relación",
  parametric: "Paramétrica (x(t), y(t))",
  polar_curve: "Polar r(θ)",
  truth_table: "Tabla de verdad",
  matrix: "Matriz",
  toggle: "Interruptor 0/1",
  venn_2: "Venn de dos conjuntos",
  venn_3: "Venn de tres conjuntos",
  cartesian: "Cartesiano",
  polar: "Polar",
  unit_circle: "Círculo unidad",
  number_line: "Recta numérica",
  blank_grid: "Cuadrícula",
  rad: "Radianes",
  deg: "Grados",
  signed: "Integral con signo",
  geometric: "Área geométrica",
  none: "Ninguno",
  arrow: "Flecha",
  dot: "Punto",
  bar: "Marca / barras",
  apple: "Manzanas",
  star: "Estrellas",
  cube: "Cubos",
  coin: "Monedas",
  circle: "Círculos",
  atom: "Átomos",
  transparent: "Transparente",
  card: "Tarjeta",
  callout_info: "Nota informativa",
  callout_step: "Paso de explicación",
  slider: "Deslizador",
  stepper: "Incrementos",
  play_pause: "Animación",
  polygon: "Polígono",
  triangle: "Triángulo",
  circle_fraction: "Fracción circular",
  sector: "Sector circular",
  prism: "Prisma (diagrama)",
  cylinder: "Cilindro (diagrama)",
  inclined_plane: "Plano inclinado (diagrama)",
  block_mass: "Bloque (diagrama)",
  table_only: "Tabla",
  histogram: "Histograma",
  pie: "Circular",
  scatter: "Dispersión",
  freehand: "Dibujo libre",
  highlighter: "Resaltador",
  callout_bubble: "Nota",
};
export function Select(
  { label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (s: string) => void;
  },
) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>{optionLabels[v] ?? v}</option>
        ))}
      </select>
    </label>
  );
}
