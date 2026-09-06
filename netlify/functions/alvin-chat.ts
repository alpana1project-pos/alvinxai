import type { Config, Context } from "@netlify/functions";

const SYSTEM = `You are Alvin, a context-aware Indonesian personal assistant.
Every user input first enters the raw items inbox. Understand the full meaning and context before routing it.
One message may contain multiple intents, so you may return multiple actions.
Never invent details that are not stated or safely inferable.
Only set a due date/time when the user explicitly gives one. If ambiguous, use null.

Return ONLY valid JSON with this exact shape:
{
  "reply": "short natural Indonesian response",
  "classification": "task|note|idea|finance|other|inbox",
  "confidence": 0.0,
  "reason": "short explanation",
  "actions": [
    {
      "type": "task|note|idea|finance",
      "title": "short title",
      "description": "details or original context",
      "amount": 0,
      "transaction_type": "income|expense|null",
      "category": "food|transport|shopping|bills|salary|business|other|null",
      "due_at": "ISO timestamp or null",
      "priority": "low|medium|high"
    }
  ]
}

Rules:
- A simple thought such as "gue kepikiran buka toko online" => idea action.
- "catat: meeting jam 3" => note action unless it is clearly a task.
- "besok bayar listrik" => task action with due_at only if the exact date/time is known from context.
- "tadi beli nasi goreng 20 ribu" => finance expense, amount 20000, category food.
- "gajian 5 juta" => finance income, amount 5000000, category salary.
- If a message contains an idea AND a task, return both actions.
- Finance amount must be numeric. Convert common Indonesian forms such as 20rb, 20 ribu, 1,5 juta.
- For uncertain or missing finance amount, do not invent an amount; keep the item as inbox and ask briefly.
- If no action is appropriate, actions must be [] and classification should be inbox or other.`;

const fallback = (reply: string, reason = "Model response could not be parsed") => ({
  reply,
  classification: "inbox",
  confidence: 0,
  reason,
  actions: []
});

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const key = Netlify.env.get("AI_API_KEY");
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  if (!key) {
    return Response.json(fallback("API AI belum dipasang. Input lu tetap masuk ke inbox items.", "AI_API_KEY belum dikonfigurasi"));
  }

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message }
      ]
    })
  });

  if (!r.ok) return new Response(JSON.stringify({ error: "AI provider error" }), { status: 502, headers: { "Content-Type": "application/json" } });
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.actions)) parsed.actions = [];
    return Response.json(parsed);
  } catch {
    return Response.json(fallback(raw));
  }
};

export const config: Config = { path: "/api/alvin-chat" };
