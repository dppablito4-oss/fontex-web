# General canvas prototype

Open `/#/laboratorio`. The stable editor remains at `/#/lienzo`; its frozen backup is `respaldo/fontex-modulos-2026-11-13` (`018501d`).

A scene contains shared expression records and generic elements (`formula`, `plot`, `table`, `text`). Elements refer to expressions by ID. There is no topic-specific module registry in this renderer. The same expression tree drives numerical evaluation, symbolic differentiation, polynomial extraction, root finding and graph sampling. Parameters a/b/c are shared across the scene and persisted with it.

Supported grammar: numbers, x/a/b/c, pi/e, arithmetic, powers, implicit multiplication, parentheses, sin/cos/tan/ln/exp/sqrt; one equality becomes a residual expression. Trigonometry uses radians. Expressions are parsed into a bounded AST; JavaScript and HTML are never evaluated. Root solving isolates real polynomial roots recursively using derivative critical points and bisection, up to degree four, including repeated roots. The graph is a sampled approximation, omits undefined values and clips the plot window.

The authenticated `scene-agent` proposes only validated scene JSON. Direct expression entry, parameter changes and calculations are local and do not call AI. Imported scenes are validated before replacing the current one. Local storage is isolated by account; JSON import/export and print/PDF are available. This prototype does not yet synchronize scenes to Supabase or migrate all legacy topics. Complex roots, integrals, general multivariable functions and 3D are outside this first version.

Validation: expression engine tests compare symbolic derivatives against finite differences and verify degree-2/3/4 roots and residuals. Edge tests verify authentication and reject executable expressions. Browser QA covers desktop/mobile, reactive parameters, scene persistence, composition and PDF rendering.
