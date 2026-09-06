import type { Config, Context } from "@netlify/functions";

const SYSTEM = `You are Alvin, a smart general-purpose Indonesian personal AI assistant.
Always answer the user's actual message naturally. You are not merely an inbox classifier.
You can chat, answer questions, explain concepts, brainstorm, plan, write, summarize, help with coding, reason, and give practical advice.
Use recent context when relevant. Match casual Indonesian when appropriate. Never invent facts or personal data.
Only create workspace actions when the user actually has something to save: idea, task, note, or finance. Normal greetings and questions must have actions: [].
For finance, normalize explicit amounts such as 20rb, 20 ribu, and 1,5 juta. Never invent amounts. Only set due_at when a date/time is explicit or safely resolvable.
Return ONLY valid JSON in this shape:
{"reply":"natural Indonesian answer","classification":"task|note|idea|finance|other|inbox","confidence":0.0,"reason":"short explanation","actions":[{"type":"task|note|idea|finance","title":"short title","description":"details","amount":0,"transaction_type":"income|expense|null","category":"food|transport|shopping|bills|salary|business|other|null","due_at":"ISO timestamp or null","priority":"low|medium|high"}]}
Examples: "Halo Alvin" => friendly reply, no actions. "Lu bisa ngapain?" => explain capabilities, no actions. "Jelasin API" => answer normally, no actions. "Gua kepikiran buka toko online" => discuss and save idea. "Besok bayar listrik" => task. "Beli nasi 20 ribu" => finance expense 20000 food.`;

const fallback = (reply: string, reason: string) => ({ reply, classification: "inbox", confidence: 0, reason, actions: [] });

function parseJson(raw: string) {
  const text = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(text); } catch {}
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

async function ask(key: string, model: string, contextText: string, message: string) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `KONTEKS TERBARU:\n${contextText}\n\nPESAN USER:\n${message}` }
      ]
    })
  });
  const data = await r.json().catch(() => ({}));
  return { r, data };
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const key = Netlify.env.get("AI_API_KEY");
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });
  if (!key) return Response.json(fallback("AI Alvin belum terhubung. Coba pasang AI_API_KEY di Netlify.", "AI_API_KEY belum dikonfigurasi"), { status: 500 });

  const contextText = JSON.stringify(body.context && typeof body.context === "object" ? body.context : {}).slice(0, 14000);
  try {
    // GPT-OSS 20B is available on Groq's current Free Plan limits and is used here instead of the older Enterprise Llama models.
    const result = await ask(key, "openai/gpt-oss-20b", contextText, message);
    if (!result.r.ok) {
      const detail = String(result.data?.error?.message || "provider error").slice(0, 220);
      const reason = `Groq ${result.r.status}: ${detail}`;
      const reply = result.r.status === 401 ? "API key Alvin ditolak provider. Ganti AI_API_KEY di Netlify." : result.r.status === 403 ? "Model AI ditolak oleh permission akun Groq. Coba cek akses model di Groq." : result.r.status === 429 ? "Batas request Groq sedang kena. Tunggu sebentar lalu coba lagi." : result.r.status === 402 ? "Akun provider AI membutuhkan billing/credits untuk request ini." : "Provider AI sedang bermasalah. Coba lagi sebentar.";
      return Response.json(fallback(reply, reason), { status: 502 });
    }
    const parsed = parseJson(result.data?.choices?.[0]?.message?.content || "");
    if (!parsed || typeof parsed !== "object") return Response.json(fallback("Gue belum bisa memproses jawaban itu dengan benar.", "Invalid model JSON"), { status: 502 });
    const allowed = ["task", "note", "idea", "finance", "other", "inbox"];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    return Response.json({
      reply: String(parsed.reply || "Oke bro, gue siap bantu."),
      classification: allowed.includes(parsed.classification) ? parsed.classification : (actions[0]?.type || "other"),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reason: String(parsed.reason || "General assistant response"),
      actions
    });
  } catch (error) {
    return Response.json(fallback("Maaf bro, koneksi ke AI lagi bermasalah. Coba lagi sebentar.", error instanceof Error ? error.message : "unknown error"), { status: 502 });
  }
};

export const config: Config = { path: "/api/alvin-chat" };
