import { BskyAgent } from "@atproto/api";

interface LabelsRequest {
  handle: string;
  appPassword: string;
  pdsUrl?: string;
}

interface Env {
  LABELLER_DID: string;
  LABELLER_SERVICE_URL: string;
}

const DEFAULT_PDS = "https://bsky.social";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  const origin = request.headers.get("Origin") ?? "";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get("Origin") ?? "";

  let body: LabelsRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
  }

  const { handle, appPassword, pdsUrl } = body;

  if (!handle || !appPassword) {
    return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders(origin) });
  }

  // Verify user identity against their PDS
  const userAgent = new BskyAgent({ service: pdsUrl || DEFAULT_PDS });
  try {
    await userAgent.login({ identifier: handle, password: appPassword });
  } catch {
    return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders(origin) });
  }

  const did = userAgent.session!.did;

  // Query the labeller service for active labels on this DID
  try {
    const serviceUrl = env.LABELLER_SERVICE_URL.replace(/\/$/, "");
    const url = `${serviceUrl}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(did)}&sources=${encodeURIComponent(env.LABELLER_DID)}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) {
      const text = await res.text();
      console.error(`queryLabels HTTP ${res.status}:`, text);
      throw new Error(`Label query returned ${res.status}`);
    }

    const data: any = await res.json();

    const labelMap = new Map<string, boolean>();
    for (const label of data.labels ?? []) {
      labelMap.set(label.val, !label.neg);
    }

    const activeLabels = [...labelMap.entries()]
      .filter(([, active]) => active)
      .map(([val]) => val);

    return Response.json({ did, labels: activeLabels }, { status: 200, headers: corsHeaders(origin) });
  } catch (err) {
    console.error("queryLabels failed:", err);
    return Response.json({ error: "Failed to fetch labels" }, { status: 500, headers: corsHeaders(origin) });
  }
};