import type { Config, Context } from "@netlify/functions";

const SYSTEM = `You are Alvin, a context-aware Indonesian personal assistant.
Every user input is conceptually received by an inbox called items first.
Understand intent and context before deciding whether it belongs to task, note, idea, or finance.
Do not rely on a single keyword. Preserve the user's original meaning.
When asked to perform a database action, return structured JSON with:
{ "reply": string, "classification": "task|note|idea|finance|other|inbox", "confidence": number, "reason": string }.
For finance, extract amount and transaction direction when possible.
For tasks, extract due date/time when possible.
For ambiguous input, keep classification as inbox and ask a concise clarification.
Never invent facts.`;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const key = Netlify.env.get("AI_API_KEY");
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  if (!key) {
    return Response.json({
      reply: "API AI belum dipasang. Input lu sudah masuk ke inbox `items`; setelah AI key dipasang, Alvin akan memilah konteksnya otomatis.",
      classification: "inbox",
      confidence: 1,
      reason: "AI_API_KEY belum dikonfigurasi"
    });
  }

  // Provider-agnostic placeholder: keep the secret server-side.
  // Configure this endpoint for the chosen OpenAI-compatible provider.
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message }
      ]
    })
  });

  if (!r.ok) return new Response(await r.text(), { status: 502 });
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = { reply: raw, classification: "inbox", confidence: 0, reason: "Invalid model JSON" }; }
  return Response.json(parsed);
};

export const config: Config = { path: "/api/alvin-chat" };