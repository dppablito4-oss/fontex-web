import type { AssessmentKind, AssessmentQuestionDraft } from "./service";

export interface AssessmentTemplate {
  title: string;
  kind: AssessmentKind;
  description: string;
  questions: AssessmentQuestionDraft[];
}

export const secondaryMathPretest: AssessmentTemplate = {
  title: "Pretest de Matemática – Secundaria",
  kind: "pretest",
  description: "Responde antes de comenzar los talleres. Marca una sola alternativa en las preguntas de selección. En las preguntas abiertas, escribe el procedimiento y las unidades cuando correspondan.",
  questions: [
    // Aritmética
    {
      prompt: "¿Qué fracción equivale al 75 %?",
      kind: "choice",
      options: ["1/4", "1/3", "3/4", "7/5"],
    },
    {
      prompt: "En una botella había 1/3 de litro de agua y se añadió 1/6 de litro. ¿Cuánta agua hay ahora?",
      kind: "choice",
      options: ["1/2 de litro", "2/9 de litro", "1/9 de litro", "2/3 de litro"],
    },
    {
      prompt: "Un artículo cuesta S/ 150 y tiene un descuento del 20 %. ¿Cuánto dinero se descuenta?",
      kind: "choice",
      options: ["S/ 15", "S/ 20", "S/ 120", "S/ 30"],
    },
    {
      prompt: "Una mochila cuesta S/ 160 y tiene un descuento del 25 %. Expresa el descuento como fracción del precio y explica cómo calculas el precio final.",
      kind: "text",
      options: [],
    },
    // Álgebra
    {
      prompt: "¿Cuál es la solución de 4x − 3 = 17?",
      kind: "choice",
      options: ["x = 3", "x = 5", "x = 7", "x = 20"],
    },
    {
      prompt: "¿En qué punto corta al eje horizontal la recta y = 3x − 12?",
      kind: "choice",
      options: ["(0, −12)", "(3, 0)", "(4, 0)", "(12, 0)"],
    },
    {
      prompt: "¿Es x = 6 una solución de 2x + 5 = 17? Sustituye el valor y explica cómo lo compruebas.",
      kind: "text",
      options: [],
    },
    {
      prompt: "Resuelve x² − 7x + 12 = 0. Muestra tu procedimiento y comprueba al menos una solución.",
      kind: "text",
      options: [],
    },
    // Geometría y datos
    {
      prompt: "Un cilindro tiene radio de 2 cm y altura de 8 cm. Si su volumen se calcula con V = πr²h, ¿cuál es su volumen exacto?",
      kind: "choice",
      options: ["32π cm³", "16π cm³", "64π cm³", "128π cm³"],
    },
    {
      prompt: "El radio interior de una lata cilíndrica aumenta de 2 cm a 4 cm y su altura se mantiene. ¿Por cuánto se multiplica su volumen? Justifica tu respuesta.",
      kind: "text",
      options: [],
    },
    {
      prompt: "Las cantidades de libros leídos por cinco estudiantes fueron 2, 4, 4, 5 y 10. ¿Cuál es la mediana?",
      kind: "choice",
      options: ["2", "5", "8", "4"],
    },
    {
      prompt: "En el conjunto 1, 3, 3, 5 y 8 se reemplaza el 8 por 13. ¿Cuáles son la nueva media y la nueva mediana?",
      kind: "choice",
      options: ["Media 4 y mediana 3", "Media 5 y mediana 3", "Media 5 y mediana 5", "Media 6 y mediana 3"],
    },
  ],
};
