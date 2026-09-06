import type { Config, Context } from "@netlify/functions";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const key = Netlify.env.get("AI_API_KEY");
  if (!key) return Response.json({ error: "AI_API_KEY belum dikonfigurasi" }, { status: 500 });

  try {
    const incoming = await req.formData();
    const audio = incoming.get("file");
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "file audio wajib dikirim" }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", audio, "alvin-voice.webm");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "id");
    form.append("response_format", "json");

    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return Response.json({ error: data?.error?.message || "Transkripsi gagal" }, { status: 502 });
    return Response.json({ text: String(data?.text || "").trim() });
  } catch {
    return Response.json({ error: "Audio tidak bisa diproses" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/alvin-transcribe" };