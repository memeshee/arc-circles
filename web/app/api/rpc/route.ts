/** Same-origin RPC proxy: keeps ARC_RPC_URL server-side so the paid
 *  key never ships in the client bundle (and adblockers can't block it).
 *  Only JSON-RPC POST bodies are forwarded. */
export async function POST(req: Request) {
  const upstream = process.env.ARC_RPC_URL;
  if (!upstream) {
    return Response.json({ error: "RPC not configured" }, { status: 503 });
  }
  let body: string;
  try {
    body = await req.text();
    JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid JSON-RPC body" }, { status: 400 });
  }
  const r = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
