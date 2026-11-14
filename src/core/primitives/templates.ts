import {
  createPrimitive,
  newPrimitiveScene,
  parsePrimitiveScene,
  type Primitive,
  type PrimitiveScene,
} from "./schema.ts";
import { organizePrimitiveScene } from "./layout.ts";
export const templates = [
  { id: "ellipse", name: "Elipse paramétrica", group: "Geometría analítica" },
  {
    id: "hyperbola",
    name: "Hipérbola con dos ramas",
    group: "Geometría analítica",
  },
  { id: "polar-rose", name: "Rosa polar", group: "Trigonometría" },
  { id: "projectile", name: "Tiro parabólico", group: "Física" },
  { id: "venn-two", name: "Operaciones entre conjuntos", group: "Conjuntos" },
  { id: "venn-three", name: "Tres conjuntos y lógica", group: "Conjuntos" },
  { id: "logic-circuit", name: "Tabla de verdad y circuito", group: "Lógica" },
  {
    id: "logic-four",
    name: "Equivalencia con cuatro proposiciones",
    group: "Lógica",
  },
  {
    id: "matrix-transform",
    name: "Transformación lineal 2D",
    group: "Álgebra lineal",
  },
  {
    id: "matrix-system",
    name: "Matriz inversa y sistema 3×3",
    group: "Álgebra lineal",
  },
  {
    id: "probability-tree",
    name: "Árbol de probabilidades",
    group: "Estadística",
  },
  {
    id: "number-jumps",
    name: "Saltos en la recta numérica",
    group: "Aritmética",
  },
  {
    id: "unit-circle",
    name: "Círculo unitario interactivo",
    group: "Trigonometría",
  },
  { id: "pythagoras", name: "Pitágoras dinámico", group: "Geometría" },
  { id: "calculus", name: "Derivada e integral", group: "Cálculo" },
  { id: "trig", name: "Seno y coseno", group: "Trigonometría" },
  { id: "polynomial", name: "Ecuación de cuarto grado", group: "Álgebra" },
  { id: "quadratic", name: "Ecuación cuadrática", group: "Álgebra" },
  { id: "cubic", name: "Ecuación cúbica", group: "Álgebra" },
  { id: "fractions", name: "Fracciones y equivalencias", group: "Aritmética" },
  { id: "sum", name: "Sumar fracciones", group: "Aritmética" },
  { id: "count", name: "Contar y agrupar", group: "Inicial" },
  { id: "geometry", name: "Áreas y perímetros", group: "Geometría" },
  { id: "irregular", name: "Polígono irregular", group: "Geometría" },
  { id: "angles", name: "Ángulos y vectores", group: "Geometría" },
  { id: "statistics", name: "Datos y regresión", group: "Estadística" },
  { id: "probability", name: "Probabilidad visual", group: "Estadística" },
  { id: "physics", name: "Movimiento rectilíneo", group: "Física" },
  { id: "circle", name: "Círculo y sectores", group: "Geometría" },
  { id: "powers", name: "Potencias y raíces", group: "Aritmética" },
  { id: "percentage", name: "Porcentajes", group: "Aritmética" },
  { id: "sequence", name: "Sucesiones", group: "Álgebra" },
  { id: "factorization", name: "Factores primos", group: "Aritmética" },
  { id: "linear", name: "Ecuación lineal", group: "Álgebra" },
  { id: "divisibility", name: "MCD y MCM", group: "Aritmética" },
  { id: "units", name: "Medidas y conversiones", group: "Aritmética" },
];
export function templateScene(id: string): PrimitiveScene {
  if (!templates.some((t) => t.id === id)) {
    throw new Error("Plantilla no disponible.");
  }
  const scene = newPrimitiveScene(
    templates.find((t) => t.id === id)?.name ?? "Mi lienzo",
  );
  const group = templates.find((t) => t.id === id)!.group;
  scene.level = id === "count"
    ? "inicial"
    : group === "Cálculo"
    ? "universidad"
    : group === "Aritmética" || group === "Geometría"
    ? "primaria"
    : "secundaria";
  const add = <K extends Primitive["kind"]>(
    kind: K,
    change?: (p: Extract<Primitive, { kind: K }>) => void,
  ) => {
    const p = createPrimitive(kind, scene);
    change?.(p);
    scene.primitives.push(p);
    return p;
  };
  const variable = (
    name: string,
    value: number,
    min: number,
    max: number,
    step = 1,
    unit = "",
  ) => {
    scene.variables.push({ name, value, min, max, step, unit });
  };
  const text = (content: string) =>
    add("math_block", (p) => {
      p.data.markdownContent = content;
    });

  if (["ellipse", "hyperbola", "polar-rose", "projectile"].includes(id)) {
    scene.variables = [];
    const plane = add("coordinate_canvas", (p) => {
      p.data.equalScale = true;
      p.data.domainX = ["-5", "5"];
      p.data.rangeY = ["-5", "5"];
    });
    const curve = (
      name: string,
      xExpr: string,
      yExpr: string,
      from: string,
      to: string,
    ) =>
      add("function_region", (p) => {
        p.data.canvasId = plane.id;
        p.data.name = name;
        p.data.expression = "0";
        p.data.curveMode = "parametric";
        p.data.xExpr = xExpr;
        p.data.yExpr = yExpr;
        p.data.parameterFromExpr = from;
        p.data.parameterToExpr = to;
        p.data.showArea = false;
        p.data.pointXs = [];
      });
    if (id === "ellipse") {
      variable("a", 3, .5, 4, .1);
      variable("b", 2, .5, 4, .1);
      variable("t", 0, 0, 2 * Math.PI, .05, "rad");
      const f = curve("f", "a*cos(t)", "b*sin(t)", "0", "2*pi");
      f.data.parameterValueExpr = "t";
      for (const name of ["a", "b", "t"]) {
        add("control_slider", (p) => {
          p.data.variableName = name;
        });
      }
      text(
        "## Una elipse completa\n$x(t)=a\\cos(t)$, $y(t)=b\\sin(t)$, de 0 a 2π.\n\nSemiejes: **{{a}}** y **{{b}}**. El punto móvil está en **({{round(a*cos(t),3)}}, {{round(b*sin(t),3)}})**.\n\nCambia los semiejes y el parámetro t. Una circunferencia se obtiene cuando a = b.",
      );
    } else if (id === "hyperbola") {
      variable("a", 1, .5, 2, .1);
      variable("b", 1, .5, 2, .1);
      curve(
        "derecha",
        "a*(exp(t)+exp(-t))/2",
        "b*(exp(t)-exp(-t))/2",
        "-2",
        "2",
      );
      curve(
        "izquierda",
        "-a*(exp(t)+exp(-t))/2",
        "b*(exp(t)-exp(-t))/2",
        "-2",
        "2",
      ).style.strokeColor = "#c47725";
      for (const name of ["a", "b"]) {
        add("control_slider", (p) => {
          p.data.variableName = name;
        });
      }
      text(
        "## Dos ramas, una relación\n$x^2/a^2-y^2/b^2=1$. Las dos ramas son curvas paramétricas separadas: no se unen a través de la discontinuidad.\n\nUsamos coseno y seno hiperbólicos expresados mediante exp(t) y exp(−t). La ventana y el intervalo del parámetro recortan la representación.",
      );
    } else if (id === "polar-rose") {
      variable("k", 3, 1, 7);
      variable("theta", 0, 0, 2 * Math.PI, .05, "rad");
      plane.data.mode = "polar";
      plane.data.domainX = ["-3", "3"];
      plane.data.rangeY = ["-3", "3"];
      const f = curve("rosa", "t", "0", "0", "2*pi");
      f.data.curveMode = "polar";
      f.data.rExpr = "2*cos(k*theta)";
      f.data.parameterValueExpr = "theta";
      for (const name of ["k", "theta"]) {
        add("control_slider", (p) => {
          p.data.variableName = name;
        });
      }
      text(
        "## Una curva polar real\n$r(θ)=2\\cos(kθ)$. El radio puede ser negativo: entonces el punto aparece en la dirección opuesta.\n\nθ = **{{round(theta,3)}} rad**, radio = **{{round(2*cos(k*theta),3)}}**. Cambia k para comparar los pétalos. Los ejes tienen la misma escala.",
      );
    } else {
      variable("vx", 4, 1, 10, .1, "m/s");
      variable("vy", 10, 1, 20, .1, "m/s");
      variable("g", 9.8, 1, 20, .1, "m/s²");
      variable("t", 0, 0, 2.04, .02, "s");
      plane.data.domainX = ["-1", "10"];
      plane.data.rangeY = ["-1", "10"];
      const f = curve("trayectoria", "vx*t", "vy*t-g*t^2/2", "0", "2*vy/g");
      f.data.parameterValueExpr = "t";
      add("control_slider", (p) => {
        p.data.variableName = "t";
        p.data.controlType = "play_pause";
      });
      text(
        "## Trayectoria ideal sin resistencia del aire\n$x(t)=v_x t$, $y(t)=v_y t-gt^2/2$.\n\nTiempo: **{{round(t,2)}} s**. Posición: **({{round(vx*t,2)}}, {{round(vy*t-g*t^2/2,2)}}) m**.\n\nEl intervalo de la curva termina en el regreso a y=0. El control de tiempo se puede ajustar en Variables; este ejemplo usa las condiciones iniciales indicadas, no una simulación general de fuerzas.",
      );
    }
  } else if (
    ["venn-two", "venn-three", "logic-circuit", "logic-four"].includes(id)
  ) {
    scene.variables = [];
    const four = id === "logic-four",
      three = id === "venn-three" || id === "logic-circuit",
      vars = four ? ["p", "q", "r", "s"] : three ? ["p", "q", "r"] : ["p", "q"];
    const expression = four
      ? "(p -> q) <-> (!r || s)"
      : three
      ? "(p && q) || !r"
      : "p && !q";
    // Variables are declared before renderers; controls can be revealed later in a presentation.
    vars.forEach((name, i) => variable(name, i === 0 ? 1 : 0, 0, 1));
    if (id.startsWith("venn")) {
      add("geometric_shape", (p) => {
        p.data.shape = three ? "venn_3" : "venn_2";
        p.data.logicVariables = vars;
        p.data.logicExpression = expression;
        p.data.setLabels = vars.map((_, i) => String.fromCharCode(65 + i));
      });
    }
    add("data_chart", (p) => {
      p.data.chartType = "truth_table";
      p.data.logicVariables = vars;
      p.data.logicExpression = expression;
    });
    if (id === "logic-circuit") {
      add("node_graph", (p) => {
        p.data.graphType = "logic";
        p.data.nodes = [
          {
            id: "p",
            label: "p",
            type: "input",
            variableName: "p",
            x: 80,
            y: 100,
          },
          {
            id: "q",
            label: "q",
            type: "input",
            variableName: "q",
            x: 80,
            y: 240,
          },
          {
            id: "r",
            label: "r",
            type: "input",
            variableName: "r",
            x: 80,
            y: 440,
          },
          {
            id: "both",
            label: "Serie",
            type: "and",
            variableName: null,
            x: 320,
            y: 170,
          },
          {
            id: "neg",
            label: "Negación",
            type: "not",
            variableName: null,
            x: 320,
            y: 440,
          },
          {
            id: "either",
            label: "Paralelo",
            type: "or",
            variableName: null,
            x: 540,
            y: 300,
          },
          {
            id: "out",
            label: "Salida",
            type: "output",
            variableName: null,
            x: 720,
            y: 300,
          },
        ];
        p.data.edges = [
          { from: "p", to: "both", label: "" },
          { from: "q", to: "both", label: "" },
          { from: "r", to: "neg", label: "" },
          { from: "both", to: "either", label: "" },
          { from: "neg", to: "either", label: "" },
          { from: "either", to: "out", label: "" },
        ];
      });
    }
    vars.forEach((name) =>
      add("control_slider", (p) => {
        p.label = `Proposición ${name}`;
        p.data.variableName = name;
        p.data.controlType = "toggle";
      })
    );
    text(
      `## Una expresión, varias representaciones\n**${expression}**.\n\n! significa negación; &&, conjunción; ||, disyunción; ->, implicación; <->, equivalencia. La tabla genera todas las combinaciones y resalta la actual.\n\n${
        id.startsWith("venn")
          ? "El sombreado representa el conjunto de combinaciones que hacen verdadera la expresión; el punto señala el estado actual."
          : "Activa las proposiciones y compara la salida. En un circuito, AND equivale a interruptores en serie y OR a caminos en paralelo. Es un circuito lógico ideal, no un cálculo eléctrico."
      }`,
    );
  } else if (id === "matrix-transform" || id === "matrix-system") {
    scene.variables = [];
    const matrix = add("data_chart", (p) => {
      p.data.chartType = "matrix";
      p.data.matrixName = "m";
      p.data.matrixCells = id === "matrix-system"
        ? [["2", "1", "0"], ["1", "2", "1"], ["0", "1", "2"]]
        : [["a", "b"], ["0", "1"]];
      p.data.showInverse = true;
    });
    if (id === "matrix-transform") {
      variable("a", 1, -2, 2, .1);
      variable("b", 0, -2, 2, .1);
      const plane = add("coordinate_canvas", (p) => {
        p.data.equalScale = true;
        p.data.domainX = ["-5", "5"];
        p.data.rangeY = ["-5", "5"];
      });
      for (const transformed of [false, true]) {
        add("geometric_shape", (p) => {
          p.data.canvasId = plane.id;
          p.data.regular = false;
          p.data.verticesExpr = [["0", "0"], ["2", "0"], ["2", "1"], [
            "0",
            "1",
          ]];
          p.data.showSideLengths = false;
          p.label = transformed ? "Imagen transformada" : "Figura original";
          p.data.transformMatrixId = transformed ? matrix.id : null;
          p.style.fillColor = transformed ? "#a7e9d3" : "#aab2bf";
          p.style.strokeColor = transformed ? "#38a989" : "#7c8798";
        });
      }
      add("vector_segment", (p) => {
        p.data.canvasId = plane.id;
        p.data.start = ["0", "0"];
        p.data.end = ["1", "1"];
        p.data.transformMatrixId = matrix.id;
        p.data.showAngleArc = false;
      });
      for (const name of ["a", "b"]) {
        add("control_slider", (p) => {
          p.data.variableName = name;
        });
      }
      text(
        "## Una matriz transforma todo el plano\n$m=\\begin{pmatrix}a&b\\\\0&1\\end{pmatrix}$. El gris muestra la figura original y el verde su imagen.\n\nDeterminante: **{{det(m)}}**. El área se multiplica por |det(m)|; un signo negativo invierte la orientación.\n\nCuando a=0, la figura colapsa y no hay inversa. La matriz puede aplicarse también a vectores desde sus campos de edición.",
      );
    } else {text(
        "## Matrices y sistemas lineales\nDeterminante: **{{det(m)}}**. Inversa: **{{inv(m)}}**.\n\nPara $m x=(1,2,3)^T$, multiplicamos por la inversa:\n\n- x₁ = **{{inv(m,1,1)+2*inv(m,1,2)+3*inv(m,1,3)}}**\n- x₂ = **{{inv(m,2,1)+2*inv(m,2,2)+3*inv(m,2,3)}}**\n- x₃ = **{{inv(m,3,1)+2*inv(m,3,2)+3*inv(m,3,3)}}**\n\nEdita las celdas y observa cuándo existe una solución única. Los cálculos son numéricos; una matriz singular no tiene inversa.",
      );}
  } else if (id === "probability-tree") {
    scene.variables = [];
    add("node_graph", (p) => {
      p.data.graphType = "relations";
      p.data.nodes = [
        {
          id: "start",
          label: "Inicio",
          type: "relation",
          variableName: null,
          x: 80,
          y: 300,
        },
        {
          id: "c",
          label: "Cara",
          type: "relation",
          variableName: null,
          x: 340,
          y: 170,
        },
        {
          id: "s",
          label: "Sello",
          type: "relation",
          variableName: null,
          x: 340,
          y: 430,
        },
        ...["CC", "CS", "SC", "SS"].map((label, i) => ({
          id: label,
          label,
          type: "relation" as const,
          variableName: null,
          x: 680,
          y: 80 + i * 140,
        })),
      ];
      p.data.edges = [
        { from: "start", to: "c", label: "1/2" },
        { from: "start", to: "s", label: "1/2" },
        ...["CC", "CS", "SC", "SS"].map((to, i) => ({
          from: i < 2 ? "c" : "s",
          to,
          label: "1/2",
        })),
      ];
    });
    text(
      "## Dos lanzamientos independientes\nCada camino tiene probabilidad $1/2\\times1/2=1/4$. Los cuatro resultados posibles suman 1.\n\nLas conexiones y sus etiquetas se editan como un diagrama general. Las probabilidades de este ejemplo son explicativas: el diagrama no impone automáticamente que cada rama sume 1.",
    );
  } else if (id === "number-jumps") {
    scene.variables = [];
    variable("a", 3, -4, 4);
    variable("b", 2, -4, 4);
    const line = add("coordinate_canvas", (p) => {
      p.label = "Suma y resta sobre la recta";
      p.height = 360;
      p.data.mode = "number_line";
      p.data.domainX = ["-9", "9"];
      p.data.showGrid = false;
      p.data.subdivisions = 20;
    });
    for (
      const [start, end, height, color] of [
        ["0", "a", 70, "#385fd5"],
        ["a", "a+b", 115, "#c47725"],
      ] as const
    ) {
      add("vector_segment", (p) => {
        p.label = start === "0"
          ? "Primer desplazamiento"
          : "Segundo desplazamiento";
        p.data.canvasId = line.id;
        p.data.start = [start, "0"];
        p.data.end = [end, "0"];
        p.data.arcHeight = height;
        p.data.headStart = "dot";
        p.data.showAngleArc = false;
        p.style.strokeColor = color;
        p.style.strokeWidth = 3;
      });
    }
    for (const name of ["a", "b"]) {
      add("control_slider", (p) => {
        p.data.variableName = name;
      });
    }
    text(
      "## Sumar es desplazarse\n1. Sal de **0** y avanza **{{a}}** unidades.\n2. Desde ahí, desplázate **{{b}}** unidades.\n3. Llegas a **{{a+b}}**: **{{a}} + ({{b}}) = {{a+b}}**.\n\nUn salto positivo va a la derecha y uno negativo a la izquierda. Para restar 2, elige b = −2: sumar su inverso aditivo equivale a restar.",
    );
  } else if (id === "unit-circle") {
    scene.variables = [];
    variable("theta", 45, 0, 360, 1, "°");
    const plane = add("coordinate_canvas", (p) => {
      p.label = "Un radio de longitud 1";
      p.data.mode = "unit_circle";
      p.data.domainX = ["-1.4", "1.4"];
      p.data.rangeY = ["-1.4", "1.4"];
      p.data.angleUnit = "deg";
    });
    add("vector_segment", (p) => {
      p.label = "Radio y ángulo";
      p.data.canvasId = plane.id;
      p.data.start = ["0", "0"];
      p.data.end = ["cos(rad(theta))", "sin(rad(theta))"];
      p.data.showMagnitude = false;
    });
    add("vector_segment", (p) => {
      p.label = "Proyección sobre el eje horizontal";
      p.data.canvasId = plane.id;
      p.data.start = ["cos(rad(theta))", "0"];
      p.data.end = ["cos(rad(theta))", "sin(rad(theta))"];
      p.data.headEnd = "dot";
      p.data.showMagnitude = false;
      p.data.showAngleArc = false;
      p.style.dashed = true;
      p.style.strokeColor = "#c47725";
    });
    add("control_slider", (p) => {
      p.data.variableName = "theta";
    });
    text(
      "## Un ángulo, tres razones\nÁngulo: **{{theta}}°**. El radio siempre mide **1**.\n\n- cos(θ) = **{{round(cos(rad(theta)),4)}}**: coordenada horizontal.\n- sin(θ) = **{{round(sin(rad(theta)),4)}}**: coordenada vertical.\n- tan(θ) = **{{round(tan(rad(theta)),4)}}**.\n\nEn 90° y 270° la tangente no está definida. La expresión convierte grados a radianes antes de calcular. Gira el radio con el deslizador y compara los cuadrantes.",
    );
  } else if (id === "pythagoras") {
    scene.level = "secundaria";
    scene.variables = [];
    variable("a", 3, 1, 8, .5, "cm");
    variable("b", 4, 1, 8, .5, "cm");
    const plane = add("coordinate_canvas", (p) => {
      p.label = "Triángulo rectángulo ABC";
      p.data.equalScale = true;
      p.data.domainX = ["-1", "10"];
      p.data.rangeY = ["-1", "10"];
    });
    add("geometric_shape", (p) => {
      p.label = "Catetos a y b";
      p.data.canvasId = plane.id;
      p.data.shape = "triangle";
      p.data.regular = false;
      p.data.verticesExpr = [["0", "0"], ["a", "0"], ["0", "b"]];
      p.data.showAngles = true;
    });
    for (const name of ["a", "b"]) {
      add("control_slider", (p) => {
        p.data.variableName = name;
      });
    }
    text(
      "## Comprueba Pitágoras\nLos catetos perpendiculares miden **{{a}} cm** y **{{b}} cm**.\n\n$c^2=a^2+b^2$: **{{a^2}} + {{b^2}} = {{a^2+b^2}}**.\n\nHipotenusa: **{{round(sqrt(a^2+b^2),4)}} cm**.\n\nÁngulos agudos: **{{round(deg(atan2(b,a)),2)}}°** y **{{round(deg(atan2(a,b)),2)}}°**; suman **90°**. El tercer ángulo es recto.\n\nCambia ambos catetos y observa cómo se mantienen estas relaciones.",
    );
  } else if (
    [
      "calculus",
      "trig",
      "polynomial",
      "quadratic",
      "cubic",
      "linear",
      "physics",
    ].includes(id)
  ) {
    const plane = add("coordinate_canvas");
    const f = add("function_region", (p) => {
      p.data.name = "f";
      p.data.resultName = "area";
    });
    if (id === "trig") {
      plane.data.domainX = ["-pi", "2*pi"];
      plane.data.rangeY = ["-2", "2"];
      f.data.expression = "a*sin(x)";
      f.data.showArea = false;
      add("function_region", (p) => {
        p.data.name = "g";
        p.data.expression = "cos(x)";
        p.data.showArea = false;
        p.style.strokeColor = "#c276e5";
      });
      text(
        "## Ondas que cambian contigo\nMueve **a** para cambiar la amplitud del seno. En x = π/2: f(x) = **{{round(f(pi/2),3)}}**.\n\nLos ángulos de estas curvas están en radianes.",
      );
    } else if (id === "physics") {
      variable("v", 2, 0, 10, .1, "m/s");
      plane.data.domainX = ["0", "5"];
      plane.data.rangeY = ["0", "20"];
      f.data.expression = "v*x";
      f.data.showArea = false;
      add("control_slider", (p) => {
        p.data.variableName = "v";
      });
      text(
        "## Posición en movimiento rectilíneo uniforme\n$s(t)=v t$. La variable x representa tiempo en segundos.\n\nEn 3 s: **{{round(v*3,2)}} m**. Velocidad: **{{v}} m/s**.\n\nEs una gráfica cinemática, no una simulación completa de fuerzas.",
      );
    } else if (id !== "calculus") {
      f.data.expression = id === "linear"
        ? "2*x+3-(x+11)"
        : id === "polynomial"
        ? "x^4-5*x^2+4"
        : id === "quadratic"
        ? "x^2-5*x+6"
        : "x^3-6*x^2+11*x-6";
      f.data.showArea = false;
      f.data.showDerivative = true;
      plane.data.rangeY = ["-5", "10"];
      text(
        "## Resolver mirando la función\nLa ecuación se cumple donde la curva corta el eje horizontal: f(x)=0. Las soluciones reales se calculan en la gráfica, hasta grado 4.\n\nCambia la expresión y compara función y derivada.",
      );
    } else {
      f.data.showDerivative = true;
      f.data.showTangent = true;
      add("control_slider");
      text(
        "## Una variable, varias representaciones\nFunción $f(x)=a x^2$. Mueve **a** y observa cómo cambian la curva, su derivada y el área.\n\nIntegral aproximada entre 0 y 2: **{{round(area,5)}} u²**.\n\nLa línea discontinua es la derivada. El área numérica se calcula localmente, con una estimación de error.",
      );
    }
  } else if (id === "geometry") {
    scene.variables = [];
    variable("b", 7, 1, 20, .1, "cm");
    variable("h", 3, 1, 20, .1, "cm");
    variable("l", 4, 1, 20, .1, "cm");
    const plane = add("coordinate_canvas", (p) => {
      p.label = "Compara las figuras";
      p.data.equalScale = true;
    });
    add("geometric_shape", (p) => {
      p.label = "Rectángulo";
      p.data.canvasId = plane.id;
      p.data.regular = false;
      p.data.verticesExpr = [["0", "0"], ["b", "0"], ["b", "h"], ["0", "h"]];
      p.style.strokeColor = "#4366df";
      p.style.fillColor = "#9bb9ff";
    });
    add("geometric_shape", (p) => {
      p.label = "Cuadrado";
      p.data.canvasId = plane.id;
      p.data.regular = false;
      p.data.verticesExpr = [["b+3", "0"], ["b+3+l", "0"], ["b+3+l", "l"], ["b+3", "l"]];
    });
    for (const [name, label] of [["b", "Base del rectángulo"], ["h", "Altura del rectángulo"], ["l", "Lado del cuadrado"]]) {
      add("control_slider", (p) => { p.label = label!; p.data.variableName = name!; });
    }
    text("### Dos figuras, la misma escala\nAzul: rectángulo de **{{b}} × {{h}} cm**. Verde: cuadrado de **{{l}} cm** de lado.\n\nEscribe las medidas o mueve los controles. El plano se adapta para mostrar ambas figuras.");
    text("## Del dibujo al cálculo\n### 1. Calcula la superficie\nEl rectángulo ocupa **base × altura**: $A=b\\cdot h$ = **{{round(b*h,2)}} cm²**. El cuadrado tiene lados iguales: $A=l^2$ = **{{round(l*l,2)}} cm²**.\n\n### 2. Recorre el borde\nEn el rectángulo sumamos dos bases y dos alturas: $P=2(b+h)$ = **{{round(2*(b+h),2)}} cm**. En el cuadrado: $P=4l$ = **{{round(4*l,2)}} cm**.\n\n### 3. Compara y explora\nLa diferencia de superficies es **{{round(abs(b*h-l*l),2)}} cm²**. Prueba una base de **100 cm**: el dibujo conserva sus proporciones y cada división del plano representa más centímetros. Acerca la vista para observar intervalos menores. El zoom cambia la vista; las medidas y los resultados se conservan.");
  } else if (
    ["irregular", "circle", "fractions", "sum"].includes(id)
  ) {
    const shape = add("geometric_shape");
    if (id === "fractions" || id === "sum") {
      scene.variables[0] = {
        name: "n",
        value: 3,
        min: 0,
        max: 8,
        step: 1,
        unit: "",
      };
      shape.data.shape = "circle_fraction";
      shape.data.divisions = 4;
      shape.data.shadedExpr = "n";
      add("control_slider", (p) => {
        p.data.variableName = "n";
      });
      text(
        id === "sum"
          ? "## Sumar partes iguales\nEjemplo: $1/4+2/4=3/4$. Conservamos el tamaño de cada parte y sumamos cuántas tenemos.\n\nModifica el numerador: **{{n}}/4 = {{round(n/4,2)}}**. Si superas cuatro partes, necesitas otra unidad. Para distintos denominadores, busca antes partes del mismo tamaño."
          : "## Una unidad dividida en partes iguales\nColoreamos **{{n}}** cuartos: $\\frac{ {{n}} }{4}$ = **{{round(n/4,2)}}**.\n\nMover el control cambia las porciones, sin cambiar el valor de una unidad.",
      );
    } else if (id === "circle") {
      shape.data.shape = "sector";
      variable("r", 3, .5, 8, .5, "cm");
      shape.data.radiusExpr = "r";
      add("control_slider", (p) => {
        p.data.variableName = "r";
      });
      text(
        "## Radio, borde y superficie\nRadio: **{{r}} cm**. Área del círculo: **{{round(pi*r^2,3)}} cm²**. Perímetro: **{{round(2*pi*r,3)}} cm**.\n\nLa porción coloreada usa las divisiones y porciones que editas sobre la figura.",
      );
    } else {
      shape.data.regular = id !== "irregular";
      text(
        id === "irregular"
          ? "## Una figura con lados distintos\nEdita los vértices para definir la figura. El motor obtiene las longitudes, suma el perímetro y calcula el área con la fórmula del polígono. Los vértices deben seguir el borde, sin cruzar sus lados."
          : "## Área y perímetro\nCambia el número de lados, su longitud y la unidad. El perímetro suma el borde; el área mide el interior. Un polígono regular tiene todos los lados y ángulos iguales.",
      );
    }
  } else if (id === "factorization") {
    variable("n", 36, 2, 360);
    add("control_slider", (p) => {
      p.data.variableName = "n";
    });
    text(
      "## Factores primos\n**{{n}} = {{factors(n)}}**.\n\nCada factor primo solo se divide entre 1 y sí mismo. El producto de los factores recupera el número original.",
    );
  } else if (id === "statistics") {
    add("data_chart", (p) => {
      p.data.chartType = "scatter";
      p.data.showLinearRegression = true;
    });
    text(
      "## Datos, tendencia y variabilidad\nCada punto corresponde a una fila. La recta de regresión resume una tendencia lineal; una asociación no demuestra causalidad. Edita valores en la tabla del objeto.",
    );
  } else if (id === "angles") {
    const c = add("coordinate_canvas");
    add("vector_segment", (p) => {
      p.data.canvasId = c.id;
      p.data.start = ["0", "0"];
      p.data.end = ["3", "2"];
    });
    text(
      "## Dirección y magnitud\nEl vector va del punto inicial al final. Su longitud se calcula con Pitágoras. El ángulo se mide desde el eje horizontal positivo.",
    );
  } else if (id === "count" || id === "percentage" || id === "probability") {
    scene.variables[0] = {
      name: "n",
      value: id === "count" ? 8 : 25,
      min: 0,
      max: id === "count" ? 20 : 100,
      step: 1,
      unit: "",
    };
    add("stamp_grid", (p) => {
      p.data.rowsExpr = id === "count" ? "4" : "10";
      p.data.colsExpr = id === "count" ? "5" : "10";
      p.data.activeCountExpr = "n";
      p.data.icon = id === "count" ? "apple" : "circle";
    });
    add("control_slider", (p) => {
      p.data.variableName = "n";
    });
    text(
      id === "count"
        ? "## Cuenta y agrupa\nHay **{{n}}** elementos resaltados. Cuenta cada elemento una sola vez y compara con los espacios disponibles."
        : id === "percentage"
        ? "## Partes de cien\n**{{n}} de 100 = {{n}} %**. Como decimal: **{{round(n/100,2)}}**."
        : "## Casos favorables y posibles\nSi los 100 casos son equiprobables y hay {{n}} favorables, $P=\\frac{ {{n}} }{100}=$ **{{round(n/100,2)}}**.",
    );
  } else if (id === "divisibility") {
    variable("m", 12, 1, 100);
    variable("n", 18, 1, 100);
    add("control_slider", (p) => {
      p.data.variableName = "m";
    });
    add("control_slider", (p) => {
      p.data.variableName = "n";
    });
    text(
      "## Múltiplos y divisores\nPara **{{m}}** y **{{n}}**: MCD = **{{gcd(m,n)}}**, MCM = **{{lcm(m,n)}}**.\n\nEl MCD es el mayor divisor compartido. El MCM es el menor múltiplo positivo compartido.",
    );
  } else if (id === "powers") {
    variable("n", 3, 1, 8);
    add("control_slider", (p) => {
      p.data.variableName = "n";
    });
    text(
      "## Potencias y raíces\n$2^{ {{n}} }=$ **{{2^n}}**. $\\sqrt{2^{ {{n}} }}=$ **{{round(sqrt(2^n),5)}}**.\n\nUna potencia repite multiplicaciones; una raíz busca una base que produzca una potencia.",
    );
  } else if (id === "units") {
    variable("m", 2, 0, 20, .1, "m");
    add("control_slider", (p) => {
      p.data.variableName = "m";
    });
    text(
      "## Misma longitud, distinta unidad\n**{{m}} m = {{round(m*100,2)}} cm = {{round(m*1000,2)}} mm**.\n\nCambiar de unidad no cambia la longitud real.",
    );
  } else if (id === "sequence") {
    variable("d", 2, -5, 5);
    add("control_slider", (p) => {
      p.data.variableName = "d";
    });
    add("data_chart", (p) => {
      p.data.chartType = "bar";
      p.data.rows = Array.from(
        { length: 6 },
        (_, i) => ({
          label: `Término ${i + 1}`,
          xExpr: String(i + 1),
          valueExpr: `1+${i}*d`,
        }),
      );
    });
    text(
      "## Sucesión aritmética\nPartimos de 1 y sumamos **{{d}}** entre términos. El sexto término es **{{1+5*d}}**.",
    );
  } else text("# Tu lienzo\nAñade elementos y vincúlalos mediante variables.");
  let presentationStep = 1;
  for (const p of scene.primitives) {
    if ("canvasId" in p.data && p.data.canvasId) {
      const parentId = p.data.canvasId;
      p.presentationStep = scene.primitives.find((parent) =>
        parent.id === parentId
      )?.presentationStep ?? 1;
    } else p.presentationStep = presentationStep++;
  }
  return parsePrimitiveScene(organizePrimitiveScene(scene));
}
