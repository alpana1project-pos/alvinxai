export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    const response = await fetch("https://pduvjnptopmqsjhlhsnj.supabase.co/functions/v1/alvin-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(publishableKey ? { apikey: publishableKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Alvin API proxy error",
    }, { status: 500 });
  }
}
