begin;

-- A separate template preserves existing publications and the technical pretest.
-- Answer keys are available only after the existing server-side admin + MFA check.
create function fontex_assessments.tics_pretest_template() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform fontex_ai.require_admin();
  return $template${
  "title": "Pretest TICs 1",
  "kind": "pretest",
  "description": "Analiza diez situaciones relacionadas con Fontex y el uso educativo de las TIC. Elige la mejor alternativa según las condiciones de cada caso. No necesitas programar ni conocer la implementación de la plataforma. Las preguntas 1 a 6 abordan criterio tecnológico y las 7 a 10, aprendizaje con Fontex. Cada acierto vale un punto; el resultado es diagnóstico.",
  "questions": [
    {
      "prompt": "En Fontex, un docente entrega un PDF para leer y un archivo editable con figuras y controles. Si un colega debe adaptar la misma actividad para otro grado, ¿qué formato le resulta más útil y por qué?",
      "kind": "choice",
      "options": [
        "El PDF, porque conserva la distribución y sirve como referencia de la versión entregada.",
        "El archivo editable, porque permite modificar los elementos y guardar una nueva versión.",
        "Una captura, porque muestra las relaciones entre las figuras sin depender del programa.",
        "El enlace de lectura, porque facilita que ambos consulten la misma presentación."
      ],
      "correct_option": "El archivo editable, porque permite modificar los elementos y guardar una nueva versión."
    },
    {
      "prompt": "Un docente prepara un lienzo y también guarda fichas con nombres y notas. Quiere compartir el ejemplo con otra clase mediante un QR. ¿Qué decisión protege mejor la información sin impedir la actividad?",
      "kind": "choice",
      "options": [
        "Compartir la carpeta del aula para que todos encuentren el ejemplo y sus archivos relacionados.",
        "Quitar los nombres del título y compartir la carpeta que contiene las fichas.",
        "Enviar un enlace de lectura al aula completa, manteniendo las notas sin posibilidad de edición.",
        "Compartir solo el ejemplo y comprobar qué puede ver una persona que abre ese enlace."
      ],
      "correct_option": "Compartir solo el ejemplo y comprobar qué puede ver una persona que abre ese enlace."
    },
    {
      "prompt": "En una actividad ya abierta, mover un deslizador cambia una gráfica al instante. Una petición nueva al asistente, en cambio, necesita conexión. ¿Qué explicación describe mejor este comportamiento?",
      "kind": "choice",
      "options": [
        "La parte interactiva puede calcularse en el dispositivo, mientras el asistente consulta un servicio externo.",
        "El cambio de la gráfica demuestra que todas las funciones de Fontex siguen disponibles sin conexión.",
        "El asistente necesita conexión por usar texto, mientras que las figuras nunca requieren servicios externos.",
        "Ambas acciones realizan el mismo proceso; la diferencia se debe únicamente a la cantidad de usuarios conectados."
      ],
      "correct_option": "La parte interactiva puede calcularse en el dispositivo, mientras el asistente consulta un servicio externo."
    },
    {
      "prompt": "Una docente edita su copia de un lienzo y el alumnado sigue viendo la versión publicada antes. El objetivo es que toda la clase trabaje con los nuevos datos. ¿Qué conviene comprobar primero?",
      "kind": "choice",
      "options": [
        "Si la copia local se exporta correctamente, sin revisar qué versión está compartida.",
        "Si el alumnado puede editar sus copias, aunque estas mantengan los datos anteriores.",
        "Si se compartió la revisión nueva y el grupo está abriendo el enlace correspondiente.",
        "Si el aula admite más participantes, porque la actualización podría depender de su tamaño."
      ],
      "correct_option": "Si se compartió la revisión nueva y el grupo está abriendo el enlace correspondiente."
    },
    {
      "prompt": "El asistente crea una actividad visual convincente, pero un resultado no coincide con el procedimiento del estudiante. Antes de corregir su respuesta, ¿qué actuación ofrece una verificación más sólida?",
      "kind": "choice",
      "options": [
        "Comparar dos respuestas del asistente y aceptar el resultado en que ambas coincidan.",
        "Pedir una explicación más extensa y usar su seguridad al responder como criterio principal.",
        "Comprobar los datos y la relación matemática con un cálculo independiente, y contrastar el resultado.",
        "Revisar que el dibujo sea proporcionado y que la explicación utilice vocabulario matemático."
      ],
      "correct_option": "Comprobar los datos y la relación matemática con un cálculo independiente, y contrastar el resultado."
    },
    {
      "prompt": "Un pretest de Fontex limita la entrega a una por navegador. Una misma persona lo abre desde otro celular. ¿Qué conclusión es más prudente sobre ese control?",
      "kind": "choice",
      "options": [
        "Reduce envíos repetidos en ese navegador, pero por sí solo no confirma una única respuesta por persona.",
        "Garantiza una respuesta por persona si ambos celulares están conectados a la misma red.",
        "Identifica automáticamente a la persona porque el enlace de la evaluación es el mismo.",
        "Impide utilizar el segundo celular si la persona escribe los mismos apellidos."
      ],
      "correct_option": "Reduce envíos repetidos en ese navegador, pero por sí solo no confirma una única respuesta por persona."
    },
    {
      "prompt": "Con Fontex quieres investigar cómo influye la altura en el volumen de un cilindro. ¿Qué secuencia permite sostener una conclusión sobre esa relación?",
      "kind": "choice",
      "options": [
        "Aumentar radio y altura a la vez y atribuir al cambio de altura toda la diferencia de volumen.",
        "Ampliar el dibujo con el zoom y comparar el tamaño que ocupa en la pantalla.",
        "Girar el cilindro para observar varias vistas y estimar el volumen a partir de su apariencia.",
        "Mantener el radio, anticipar qué ocurrirá al variar la altura y registrar los volúmenes para contrastarlo."
      ],
      "correct_option": "Mantener el radio, anticipar qué ocurrirá al variar la altura y registrar los volúmenes para contrastarlo."
    },
    {
      "prompt": "Dos estudiantes creen que 1/2 es mayor que 2/4 porque tiene menos partes. ¿Qué actividad en el lienzo ayuda más a discutir esa idea?",
      "kind": "choice",
      "options": [
        "Mostrar las fracciones sobre figuras de tamaños distintos y comparar cuántas partes están coloreadas.",
        "Usar dos unidades del mismo tamaño, representar ambas fracciones y pedir que comparen la cantidad coloreada.",
        "Exponer la regla de fracciones equivalentes y pedir que copien el ejemplo sin modificarlo.",
        "Ordenar los denominadores de menor a mayor y usar ese orden para comparar las fracciones."
      ],
      "correct_option": "Usar dos unidades del mismo tamaño, representar ambas fracciones y pedir que comparen la cantidad coloreada."
    },
    {
      "prompt": "Tras una actividad en Fontex, la mayoría alcanza la nota esperada, pero varias respuestas muestran el mismo razonamiento incorrecto. ¿Cómo aprovecharías esa información?",
      "kind": "choice",
      "options": [
        "Revisar los procedimientos, proponer un contraejemplo interactivo y pedir que expliquen qué cambia.",
        "Avanzar al siguiente tema porque la nota global demuestra que el objetivo ya se alcanzó.",
        "Repetir las mismas preguntas con otro orden de opciones para confirmar la nota.",
        "Entregar la solución completa antes de volver a pedir una respuesta al mismo problema."
      ],
      "correct_option": "Revisar los procedimientos, proponer un contraejemplo interactivo y pedir que expliquen qué cambia."
    },
    {
      "prompt": "En una actividad de Fontex, los vectores se distinguen solo por colores. Una estudiante no logra diferenciarlos en su pantalla. ¿Qué mejora conserva la actividad y facilita comprenderla?",
      "kind": "choice",
      "options": [
        "Aumentar la intensidad de los colores y conservar la misma forma de identificar cada vector.",
        "Pintar todos los vectores del mismo color para que ninguna diferencia visual distraiga.",
        "Combinar colores con etiquetas y estilos de línea, e indicar qué representa cada vector.",
        "Sustituir la interacción por una captura más grande y mantener la identificación solo por color."
      ],
      "correct_option": "Combinar colores con etiquetas y estilos de línea, e indicar qué representa cada vector."
    }
  ]
}$template$::jsonb;
end;
$$;

create function public.admin_get_tics_pretest() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select fontex_assessments.tics_pretest_template();
$$;

revoke all on function fontex_assessments.tics_pretest_template(),
  public.admin_get_tics_pretest() from public, anon, authenticated;
grant execute on function fontex_assessments.tics_pretest_template(),
  public.admin_get_tics_pretest() to authenticated;

notify pgrst, 'reload schema';
commit;
