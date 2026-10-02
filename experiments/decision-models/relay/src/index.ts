// Local relay for Workers AI: `wrangler dev --remote` binds env.AI with the existing wrangler login,
// so no API token has to be minted. POST /v1/systemone?model=clef|clef-flash
interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
}

const MODEL_IDS: Record<string, string> = {
  clef: "@cf/cloudflare/clef",
  "clef-flash": "@cf/cloudflare/clef-flash",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const id = MODEL_IDS[url.searchParams.get("model") ?? ""];
    if (req.method !== "POST" || url.pathname !== "/v1/systemone" || !id) {
      return new Response("not found", { status: 404 });
    }
    const input = (await req.json()) as Record<string, unknown>;
    try {
      const out = await env.AI.run(id, input);
      return Response.json(out);
    } catch (e) {
      return new Response(String(e).slice(0, 500), { status: 502 });
    }
  },
};
