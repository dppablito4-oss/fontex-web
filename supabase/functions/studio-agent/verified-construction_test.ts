import { strict as assert } from "node:assert";
import { verifiedConstruction } from "./verified-construction.ts";
import { createPrimitiveHandler } from "./primitive-handler.ts";
import {
  applyPrimitivePatch,
  newPrimitiveScene,
} from "../../../src/core/primitives/schema.ts";
import { templateScene } from "../../../src/core/primitives/templates.ts";
const question =
  "Crea un ejercicio interactivo de nivel Secundaria sobre cinemática y cálculo de áreas bajo la curva que combine simultáneamente todos estos elementos vinculados entre sí:\n\n1. Control de variable: Crea 3 deslizadores dinámicos: velocidad inicial 'v0' (de 0 a 20 m/s, paso 0.5), aceleración 'a' (de -5 a 10 m/s², paso 0.5) y tiempo límite 'T' (de 1 a 15 s, paso 1).\n2. Plano y cuadrícula + Función y área: Grafica la función lineal de velocidad v(t) = v0 + a*t y sombrea dinámicamente el área bajo la curva desde t = 0 hasta t = T (que representa el desplazamiento Δx).\n3. Vector y segmento + Figura geométrica: Dibuja un móvil representado por un polígono (rectángulo con ruedas) sobre el eje horizontal cuya posición x(T) se actualice en tiempo real según el área calculada, acompañado de dos vectores dinámicos que nazcan de su centro: uno azul para la velocidad actual v(T) y otro rojo para la aceleración 'a' (que invierta su sentido si a < 0).\n4. Tabla y gráfico: Genera una tabla de tabulación automática de 6 filas (para t = 0, T/5, 2T/5, 3T/5, 4T/5, T) mostrando tiempo, velocidad instantánea y desplazamiento acumulado, vinculada a un gráfico de barras comparativo.\n5. Texto y fórmula: Muestra un bloque LaTeX dinámico que reemplace en vivo los valores de los deslizadores dentro de la ecuación Δx = v0·T + ½·a·T² y muestre el resultado numérico exacto.\n6. Nodos y circuitos: Añade un diagrama lógico de 3 nodos conectados (Input: Parámetros -> Proceso: Integración -> Output: Desplazamiento) que cambie el color de sus enlaces si el movimiento es acelerado (a > 0), uniforme (a = 0) o desacelerado (a < 0).\n7. Respuesta del alumno + Trazo y anotación: Incluye dos cajas de validación numérica para que el estudiante calcule 'v(T)' y 'Δx' cuando v0 = 4, a = 2 y T = 5, dejando un espacio libre demarcado con cuadrícula punteada y guía de trazo para que realice su procedimiento a mano alzada.";
Deno.test("the reviewed kinematics request opens its complete composition without provider or credit calls", async () => {
  const scene = newPrimitiveScene();
  const handler = createPrimitiveHandler(() => undefined, () => {
    throw Error("Paid provider must not be called");
  }, {
    reserve: () => {
      throw Error("No credit charge for a verified composition");
    },
    finish: () => {
      throw Error("No settlement needed");
    },
  });
  const response = await handler(
    new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        question,
        task: "build",
        level: "secundaria",
        selectedId: null,
      }),
    }),
    { userClaims: { id: "user" } },
  );
  assert.equal(response.status, 200);
  const reply = await response.json();
  const built = applyPrimitivePatch(scene, reply, templateScene);
  assert.equal(built.primitives.length, 27);
  assert.equal(built.variables.length, 3);
  assert.ok(reply.message.includes("sin consumir créditos"));
  const normalized = await verifiedConstruction(
    scene,
    question.toUpperCase().replace(/\n/g, "   "),
  );
  assert.ok(normalized);
});
Deno.test("verified recipes never substitute a custom request or replace existing work", async () => {
  const scene = newPrimitiveScene();
  assert.equal(
    await verifiedConstruction(
      scene,
      question + " Cambia los intervalos y añade una parábola.",
    ),
    null,
  );
  scene.primitives.push(
    (await import("../../../src/core/primitives/schema.ts")).createPrimitive(
      "math_block",
      scene,
    ),
  );
  assert.equal(await verifiedConstruction(scene, question), null);
});
