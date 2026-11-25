begin;

alter table fontex_assessments.questions add column correct_option text;
alter table fontex_assessments.questions add constraint assessment_correct_option
  check (correct_option is null or (kind = 'choice' and correct_option = any(options)));

create or replace function fontex_assessments.create_form(
  p_request uuid, p_title text, p_kind text, p_description text, p_questions jsonb, p_code_count integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := fontex_ai.require_admin();
  item jsonb;
  item_position integer;
  item_prompt text;
  item_kind text;
  item_options jsonb;
  normalized_options text[];
  correct_option text;
  keyed_count integer;
begin
  if p_request is null or p_title is null or char_length(btrim(p_title, E' \t\r\n')) not between 1 and 120
     or p_kind is null or p_kind not in ('survey', 'pretest')
     or p_description is null or char_length(p_description) > 600
     or p_code_count is null or p_code_count not between 0 and 200
     or jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'assessment_invalid_form' using errcode = '22023';
  end if;
  if jsonb_array_length(p_questions) not between 1 and 30 or octet_length(p_questions::text) > 200000 then
    raise exception 'assessment_invalid_form' using errcode = '22023';
  end if;

  select count(*) into keyed_count
  from jsonb_array_elements(p_questions) q(value)
  where q.value ? 'correct_option';
  if keyed_count > 0 and (p_kind <> 'pretest' or p_code_count <> 0
     or keyed_count <> 10 or keyed_count <> jsonb_array_length(p_questions)) then
    raise exception 'assessment_invalid_form' using errcode = '22023';
  end if;

  insert into fontex_assessments.forms (id, created_by, title, kind, description)
    values (p_request, actor, btrim(p_title, E' \t\r\n'), p_kind, btrim(p_description, E' \t\r\n'))
    on conflict (id) do nothing;
  if not found then
    if exists (select 1 from fontex_assessments.forms where id = p_request and created_by = actor) then
      return p_request;
    end if;
    raise exception 'assessment_unavailable' using errcode = '42501';
  end if;

  for item, item_position in
    select e.value, e.ordinality::integer from jsonb_array_elements(p_questions) with ordinality e
  loop
    item_prompt := btrim(item->>'prompt', E' \t\r\n');
    item_kind := item->>'kind';
    item_options := item->'options';
    if jsonb_typeof(item->'prompt') is distinct from 'string'
       or char_length(item_prompt) not between 1 and 400
       or item_kind is null or item_kind not in ('text', 'choice', 'multiple')
       or jsonb_typeof(item_options) is distinct from 'array' then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    if (item_kind = 'text' and jsonb_array_length(item_options) <> 0)
       or (item_kind <> 'text' and jsonb_array_length(item_options) not between 2 and 8)
       or exists (select 1 from jsonb_array_elements(item_options) o(value) where jsonb_typeof(o.value) <> 'string') then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    normalized_options := array(
      select btrim(o.value, E' \t\r\n')
      from jsonb_array_elements_text(item_options) with ordinality o(value, position)
      order by o.position
    );
    if exists (select 1 from unnest(normalized_options) v(option) where char_length(v.option) not between 1 and 180 or v.option ~ E'[\\r\\n]')
       or cardinality(normalized_options) <> (select count(distinct v.option) from unnest(normalized_options) v(option)) then
      raise exception 'assessment_invalid_question' using errcode = '22023';
    end if;
    correct_option := null;
    if keyed_count > 0 then
      correct_option := btrim(item->>'correct_option', E' \t\r\n');
      if item_kind <> 'choice' or jsonb_typeof(item->'correct_option') is distinct from 'string'
         or not (correct_option = any(normalized_options)) then
        raise exception 'assessment_invalid_question' using errcode = '22023';
      end if;
    end if;
    insert into fontex_assessments.questions (form_id, position, prompt, kind, options, correct_option)
      values (p_request, item_position, item_prompt, item_kind, normalized_options, correct_option);
  end loop;

  insert into fontex_assessments.codes (form_id, code)
  select p_request, upper(left(replace(gen_random_uuid()::text, '-', ''), 12))
  from generate_series(1, p_code_count);

  return p_request;
end;
$$;

-- Only reachable from the existing authorized detail and browser receipt functions.
create function fontex_assessments.result_score(p_form uuid, p_code text) returns integer
language sql stable set search_path = '' as $$
  select count(*) filter (where a.answer = q.correct_option)::integer
  from fontex_assessments.questions q
  left join fontex_assessments.answers a on a.form_id = q.form_id and a.position = q.position and a.code = p_code
  where q.form_id = p_form
  having count(q.correct_option) = 10;
$$;
revoke all on function fontex_assessments.result_score(uuid, text) from public, anon, authenticated;

create or replace function fontex_assessments.form_detail(p_form uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  return (
    select jsonb_build_object(
      'id', f.id, 'token', f.token, 'title', f.title, 'description', f.description,
      'kind', f.kind, 'is_open', f.is_open, 'created_at', f.created_at,
      'questions', fontex_assessments.read_questions(f.id),
      'graded', exists (select 1 from fontex_assessments.questions q where q.form_id = f.id and q.correct_option is not null),
      'codes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'code', c.code, 'student_name', s.student_name, 'submitted_at', s.submitted_at,
          'score', case when s.code is not null then fontex_assessments.result_score(f.id, s.code) end
        ) order by c.code), '[]'::jsonb)
        from fontex_assessments.codes c
        left join fontex_assessments.submissions s using (form_id, code)
        where c.form_id = f.id
      )
    )
    from fontex_assessments.forms f where f.id = p_form and f.created_by = actor
  );
end;
$$;

create or replace function fontex_assessments.read_for_browser(p_token uuid, p_browser uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  target fontex_assessments.forms;
  receipt_code text;
begin
  if p_browser is null then return jsonb_build_object('state', 'closed'); end if;
  select f.* into target from fontex_assessments.forms f
  where f.token = p_token and fontex_beta.allowed(f.created_by)
    and exists (select 1 from fontex_ai.admins where user_id = f.created_by);
  if not found then return jsonb_build_object('state', 'closed'); end if;
  select s.code into receipt_code
  from fontex_assessments.submissions s where s.form_id = target.id and s.browser_id = p_browser;
  if found then
    return jsonb_build_object('state', 'submitted', 'title', target.title,
      'score', fontex_assessments.result_score(target.id, receipt_code));
  end if;
  if not target.is_open then return jsonb_build_object('state', 'closed', 'title', target.title); end if;
  return jsonb_build_object('state', 'open', 'title', target.title, 'kind', target.kind,
    'description', target.description, 'question_version', target.question_version,
    'graded', exists (select 1 from fontex_assessments.questions q where q.form_id = target.id and q.correct_option is not null),
    'questions', fontex_assessments.read_questions(target.id));
end;
$$;

create or replace function fontex_assessments.delete_question(p_form uuid, p_position integer) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := fontex_ai.require_admin();
begin
  perform 1 from fontex_assessments.forms f where f.id = p_form and f.created_by = actor for update;
  if not found then raise exception 'assessment_unavailable' using errcode = '42501'; end if;
  if not exists (select 1 from fontex_assessments.questions q where q.form_id = p_form and q.position = p_position) then
    return;
  end if;
  if (select count(*) from fontex_assessments.questions q where q.form_id = p_form) <= 1 then
    raise exception 'assessment_last_question' using errcode = '22023';
  end if;
  if exists (select 1 from fontex_assessments.questions q where q.form_id = p_form and q.correct_option is not null) then
    raise exception 'assessment_fixed_grade' using errcode = '22023';
  end if;
  delete from fontex_assessments.questions q where q.form_id = p_form and q.position = p_position;
  update fontex_assessments.forms f set question_version = question_version + 1 where f.id = p_form;
end;
$$;

create function fontex_assessments.university_pretest_template() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform fontex_ai.require_admin();
  return jsonb_build_object(
    'title', 'Pretest universitario de Fontex',
    'kind', 'pretest',
    'description', 'Selecciona la mejor alternativa en cada caso. Las preguntas 1 a 6 evalúan arquitectura y desarrollo. Las preguntas 7 a 10 evalúan el uso de Fontex. Cada acierto vale un punto.',
    'questions', (
      select jsonb_agg(jsonb_build_object(
        'prompt', prompt, 'kind', 'choice', 'options', options, 'correct_option', options[correct]
      ) order by position)
      from (values
        (1, 'Una construcción ya está abierta en el Lienzo y la conexión se interrumpe. Según la separación entre motor local y servicios remotos, ¿qué tarea sigue disponible?',
          array['Sincronizar la última revisión con otra cuenta.', 'Cambiar un parámetro local y observar cómo se recalcula la construcción.', 'Buscar fragmentos en un PDF privado de la Biblioteca.', 'Solicitar una nueva construcción al asistente de IA.'], 2),
        (2, 'El asistente entrega un JSON válido sintácticamente, pero una figura hace referencia a una variable inexistente. ¿Qué harías antes de incorporar la propuesta al Lienzo?',
          array['Guardar la propuesta como versión definitiva y comprobar el resultado al exportar.', 'Aceptar la propuesta porque el JSON se puede leer y resolver la referencia en el siguiente guardado.', 'Sustituir todas las variables por cero antes de mostrar la escena.', 'Validar el esquema y las referencias, y conservar la escena anterior si falla la validación.'], 4),
        (3, 'Dos figuras usan la misma variable de altura. Se reporta que al editarla solo cambia una figura. ¿Qué prueba ayuda más a localizar el fallo?',
          array['Cambiar una vez la variable compartida y verificar los valores derivados de las dos figuras en la misma escena.', 'Crear dos variables de altura independientes y confirmar que ambas se puedan guardar.', 'Volver a abrir la escena y verificar solo el valor guardado de la variable.', 'Comparar una captura antes y después sin inspeccionar los valores calculados.'], 1),
        (4, 'Una escena se ve correctamente al editarla, pero el PDF corta una de las figuras. ¿Qué comprobación aísla mejor la causa?',
          array['Probar varias escenas distintas y comparar únicamente el tamaño de los PDF.', 'Modificar la fórmula de la figura y volver a probar todo el flujo.', 'Exportar una escena fija y comparar el encuadre y las dimensiones capturadas con la vista guardada.', 'Volver a generar la escena con IA y comprobar si la nueva escena exporta bien.'], 3),
        (5, 'Un PDF compartido deja de estar disponible para un estudiante tras revocar su permiso. ¿Qué prueba verifica que la restricción también funciona en el Tutor documental?',
          array['Confirmar que el PDF ya no aparece en la lista visible de la Biblioteca.', 'Abrir el PDF desde la cuenta que sigue siendo propietaria.', 'Preguntar por otro PDF desde la cuenta del estudiante.', 'Hacer una consulta pertinente como ese estudiante y comprobar que la recuperación no devuelve fragmentos del PDF revocado.'], 4),
        (6, 'Vas a añadir una primitiva matemática y hay escenas guardadas de una versión anterior. ¿Qué comprobación reduce mejor el riesgo de romper compatibilidad?',
          array['Validar solo las escenas que usan la nueva primitiva.', 'Cargar una escena anterior conservando sus valores y probar que una nueva se pueda guardar y reabrir.', 'Comprobar que las dos escenas muestren el mismo número de objetos.', 'Exportar un PDF de la nueva escena y comparar su tamaño con el de un PDF anterior.'], 2),
        (7, 'En el Lienzo quieres comparar cómo cambia el volumen de un cilindro al variar el radio. ¿Qué procedimiento permite atribuir el cambio al radio?',
          array['Cambiar el radio y la altura en la misma proporción y comparar los volúmenes.', 'Girar el cilindro y estimar la diferencia con el tamaño que se ve en pantalla.', 'Fijar la altura, variar solo el radio y registrar el volumen para cada valor.', 'Cambiar el zoom hasta que el diámetro en pantalla se duplique y registrar el volumen.'], 3),
        (8, 'Preparaste una construcción con una vista concreta y necesitas entregarla para revisar el encuadre y también poder editarla después. ¿Qué debes conservar?',
          array['El PDF para revisar la vista y el JSON para reabrir la escena editable.', 'Solo el PDF, porque también guarda las variables de la escena para editar.', 'Solo el JSON, porque la revisión del encuadre se realiza directamente en cualquier lector de PDF.', 'Una captura de pantalla y una lista de resultados, porque juntos permiten reabrir la escena.'], 1),
        (9, 'En el Tutor documental necesitas verificar si una afirmación está respaldada por el PDF de una clase. ¿Qué acción te da evidencia revisable?',
          array['Pedir que reformule la afirmación; si suena más precisa, darla por verificada.', 'Consultar al asistente del Lienzo y tomar la construcción generada como cita.', 'Comparar dos respuestas del Tutor sin abrir sus fuentes.', 'Seleccionar el PDF pertinente, pedir una respuesta con cita y comprobar la página o fragmento en la fuente.'], 4),
        (10, 'En una práctica el valor esperado y tu resultado difieren después de mover varios controles. ¿Cómo identificarías qué cambio produjo la diferencia?',
          array['Hacer varios ajustes más hasta que el valor coincida y anotar el último.', 'Partir de una configuración conocida, cambiar un valor por vez y comparar con el cálculo esperado.', 'Restablecer la actividad y entregar el primer resultado que aparezca.', 'Cambiar la presentación de la escena y volver a leer el mismo resultado.'], 2)
      ) as items(position, prompt, options, correct)
    )
  );
end;
$$;

create function public.admin_get_university_pretest() returns jsonb
language sql stable set search_path = '' as $$
  select fontex_assessments.university_pretest_template();
$$;

revoke all on function fontex_assessments.university_pretest_template(),
  public.admin_get_university_pretest() from public, anon, authenticated;
grant execute on function fontex_assessments.university_pretest_template(),
  public.admin_get_university_pretest() to authenticated;

notify pgrst, 'reload schema';
commit;
