export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const body = await req.json();
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    if (!publishableKey) {
      return Response.json({ error: "VITE_SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi di Vercel." }, { status: 500 });
    }

    const response = await fetch("https://pduvjnptopmqsjhlhsnj.supabase.co/functions/v1/alvin-chat", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return Response.json({
      reply: timedOut ? "Bro, server AI kelamaan merespons. Coba kirim lagi." : "Bro, koneksi ke server Alvin bermasalah.",
      error: timedOut ? "Alvin API timeout after 25s" : (error instanceof Error ? error.message : "Alvin API proxy error"),
      classification: "inbox",
      confidence: 0,
      reason: timedOut ? "Vercel proxy timeout" : "Vercel proxy error",
      actions: [],
    }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
