import type { Config, Context } from "@netlify/functions";

const SYSTEM = `You are Alvin, a smart general-purpose Indonesian personal AI assistant.

Your first responsibility is to understand and answer the user's actual message naturally. You are NOT merely an inbox classifier.
You can have normal conversations, answer questions, explain concepts, brainstorm, plan, write, summarize, help with coding, reason through problems, and give practical advice.

PERSONAL WORKSPACE:
The app may also store every user message as a raw item. This does NOT mean every message should be announced as an inbox action. Only create workspace actions when the message actually contains something that should be saved or recorded.

BEHAVIOR:
- Always provide a useful answer in `reply`.
- For greetings and casual conversation, simply respond naturally. Never say the message was put into the inbox unless the user asked to save it.
- Match the user's Indonesian/casual style when appropriate.
- Use recent conversation/workspace context for follow-ups such as "yang tadi", "itu", "lanjut", and similar references.
- Do not invent facts, personal information, dates, prices, or amounts.
- If the user asks for current information or explicitly asks to search the web, do not pretend that you searched; say that web search is not currently available in this AI endpoint.
- Never claim an external action was completed unless the application actually performs it.

ROUTING:
- Explicit save/catat/simpan/ingat request => create the appropriate workspace action.
- A meaningful idea the user wants preserved => idea.
- A concrete thing the user needs to do => task.
- A fact/text the user wants stored => note.
- Money spent or received => finance.
- One message can create multiple actions.
- Do not create actions merely because words like "besok", "uang", "ide", or "catat" appear; understand the whole sentence.
- Finance amount must be explicit or safely normalized from forms such as 20rb, 20 ribu, 1,5 juta. Never invent an amount.
- Only set due_at when an explicit date/time is provided or safely resolvable from context.
- If no workspace action is appropriate, actions MUST be [].

OUTPUT:
Return ONLY valid JSON with this exact shape:
{
  "reply":"natural Indonesian answer",
  "classification":"task|note|idea|finance|other|inbox",
  "confidence":0.0,
  "reason":"short routing explanation",
  "actions":[{
    "type":"task|note|idea|finance",
    "title":"short title",
    "description":"details or original context",
    "amount":0,
    "transaction_type":"income|expense|null",
    "category":"food|transport|shopping|bills|salary|business|other|null",
    "due_at":"ISO timestamp or null",
    "priority":"low|medium|high"
  }]
}

EXAMPLES:
"Halo Alvin" => friendly greeting, actions: []
"Lu bisa ngapain?" => explain capabilities, actions: []
"Jelasin API itu apa" => explain it clearly, actions: []
"Bantu bikin roadmap belajar coding" => provide a roadmap, actions: []
"Gua kepikiran buka toko online" => discuss/help with the idea and save an idea action.
"Tolong catat meeting sama Andi jam 3" => confirm naturally and save a note action.
"Besok gue harus bayar listrik" => acknowledge and create a task action.
"Tadi gue beli nasi goreng 20 ribu" => acknowledge and create a finance expense action for 20000/food.
"Gajian 5 juta" => acknowledge and create a finance income action for 5000000/salary.`;

const fallback = (reply: string, reason = "Model response could not be parsed") => ({
  reply,
  classification: "inbox",
  confidence: 0,
  reason,
  actions: []
});

function parseModelJson(raw: string) {
  const text = String(raw || "").trim();
  try { return JSON.parse(text); } catch {}
  const unfenced = text.replace(/^```json\\s*/i, "").replace(/\\s*```$/i, "");
  try { return JSON.parse(unfenced); } catch {}
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch {}
  }
  return null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const key = Netlify.env.get("AI_API_KEY");
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  if (!key) {
    return Response.json(fallback("AI Alvin belum terhubung. Coba pasang AI_API_KEY di Netlify.", "AI_API_KEY belum dikonfigurasi"));
  }

  const context = body.context && typeof body.context === "object" ? body.context : {};
  const contextText = JSON.stringify(context).slice(0, 14000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.35,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `KONTEKS TERBARU (gunakan hanya jika relevan):\n${contextText}\n\nPESAN USER BARU:\n${message}`
          }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return Response.json(
        fallback("Maaf bro, AI lagi bermasalah sebentar. Coba kirim lagi.", `AI provider error ${response.status}`),
        { status: 502 }
      );
    }

    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(raw);
    if (!parsed || typeof parsed !== "object") {
      return Response.json(fallback("Gue belum bisa memproses jawaban itu dengan benar.", "Invalid model JSON"));
    }

    const allowed = ["task", "note", "idea", "finance", "other", "inbox"];
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const classification = allowed.includes(parsed.classification)
      ? parsed.classification
      : (actions[0]?.type || "other");

    return Response.json({
      reply: String(parsed.reply || "Oke bro, gue siap bantu."),
      classification,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reason: String(parsed.reason || "General assistant response"),
      actions
    });
  } catch (error) {
    return Response.json(
      fallback("Maaf bro, koneksi ke AI lagi bermasalah. Coba lagi sebentar.", error instanceof Error ? error.message : "unknown error"),
      { status: 502 }
    );
  }
};

export const config: Config = { path: "/api/alvin-chat" };
