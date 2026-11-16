import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { BodyError, jsonObject } from "../_shared/http.ts";
import { parsePrimitiveScene } from "../../../src/core/primitives/schema.ts";
import { validatePracticeAttempt } from "../../../src/core/primitives/practice.ts";
const headers = {
  "X-Fontex-Classroom-Contract": "classroom-learning-v092",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-classroom-guest",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { headers, status });
  if (req.method !== "POST") {
    return reply({ message: "Método no permitido." }, 405);
  }
  try {
    const data = await jsonObject(req, 1100000);
    if (typeof data.lesson !== "string" || !uuid.test(data.lesson)) {
      throw new BodyError("Clase inválida.");
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const guest = req.headers.get("x-classroom-guest");
    let user: string | null = null;
    if (guest) {
      if (!/^[a-f\d]{64}$/.test(guest)) {
        throw new BodyError("Invitación inválida.", 401);
      }
    } else {
      const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
      if (!token) {
        throw new BodyError(
          "Inicia sesión o entra con la invitación del aula.",
          401,
        );
      }
      const { data: auth, error } = await admin.auth.getUser(token);
      if (error || !auth.user?.email_confirmed_at) {
        throw new BodyError("Confirma tu cuenta para continuar.", 401);
      }
      user = auth.user.id;
    }
    const actor = { p_id: data.lesson, p_guest: guest, p_user: user };
    const { data: lesson, error } = await admin.rpc(
      "class_lesson_for_service",
      actor,
    );
    if (error || !lesson) {
      throw new BodyError(
        "Tu acceso a esta clase venció o no está autorizado.",
        403,
      );
    }
    if (data.action === "save") {
      if (lesson.teacher) {
        throw new BodyError("Las entregas corresponden a los estudiantes.");
      }
      const scene = validatePracticeAttempt(
        parsePrimitiveScene(lesson.scene),
        data.scene,
      );
      const { data: id, error: problem } = await admin.rpc(
        "save_class_attempt",
        { ...actor, p_scene: scene, p_submit: data.submit === true },
      );
      if (problem) {
        throw new BodyError(
          "No se pudo guardar la actividad. Inténtalo de nuevo.",
          503,
        );
      }
      return reply({ id });
    }
    if (data.action === "material") {
      if (
        typeof data.path !== "string" ||
        !lesson.attachments.some((a: { path: string }) => a.path === data.path)
      ) throw new BodyError("Archivo no disponible.", 404);
      const { data: url, error: problem } = await admin.storage.from(
        "class-materials",
      ).createSignedUrl(data.path, 300);
      if (problem) throw new BodyError("No se pudo abrir el archivo.", 503);
      return reply({ url: url.signedUrl });
    }
    if (data.action === "notify") {
      if (guest || !lesson.teacher) {
        throw new BodyError("Solo el docente puede enviar avisos.", 403);
      }
      const configured = Deno.env.get("FONTEX_SMTP_PASSWORD");
      const password = configured ||
        (await admin.rpc("class_smtp_password")).data;
      if (!password) {
        return reply({
          sent: 0,
          pending: true,
          message:
            "Clase publicada. Los avisos están pendientes de conectar el SMTP de Gmail a esta función.",
        });
      }
      const { data: batch, error: problem } = await admin.rpc(
        "class_notification_batch",
        { p_lesson: data.lesson, p_user: user },
      );
      if (problem) throw new BodyError("No se pudo preparar los avisos.", 403);
      const sender = Deno.env.get("FONTEX_SMTP_USER") ||
        "pabloclsa87@gmail.com";
      const transport = nodemailer.createTransport({
        host: Deno.env.get("FONTEX_SMTP_HOST") || "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: sender, pass: password },
        connectionTimeout: 10000,
        socketTimeout: 15000,
      });
      let sent = 0;
      const items = batch?.items ?? [];
      const send = async (
        item: { id: string; email: string; title: string },
      ) => {
        let success = false;
        try {
          await transport.sendMail({
            from: { name: "Fontex", address: sender },
            to: item.email,
            messageId: `<fontex-class-${item.id}@fontex.sypablitodp.site>`,
            subject: `Nueva clase: ${item.title}`,
            text:
              `Tu docente publicó «${item.title}» en Fontex.\n\nAbre el lienzo, los materiales y la actividad:\nhttps://fontex.sypablitodp.site/#/clase/${data.lesson}\n\nInicia sesión con este correo para acceder a tu aula.`,
          });
          success = true;
          sent++;
        } catch {
          /* Store only delivery state; never SMTP credentials or message content. */
        }
        await admin.rpc("finish_class_notification", {
          p_id: item.id,
          p_success: success,
        });
      };
      for (let start = 0; start < items.length; start += 5) {
        await Promise.all(items.slice(start, start + 5).map(send));
      }
      const pending = Math.max(0, (batch?.remaining ?? 0) - sent);
      return reply({
        sent,
        pending: pending > 0,
        message: `${sent} avisos enviados. ${
          pending
            ? `${pending} pendientes; reintenta desde la clase.`
            : "Todos los avisos están enviados."
        }`,
      });
    }
    throw new BodyError("Acción inválida.");
  } catch (e) {
    return reply({
      message: e instanceof BodyError ? e.message : e instanceof Error &&
          /Solo puedes|No puedes|Escribe|Respeta/.test(e.message)
        ? e.message
        : "No se pudo completar la acción.",
    }, e instanceof BodyError ? e.status : 400);
  }
});
