import { BskyAgent } from "@atproto/api";

interface LabelsRequest {
  // App password path
  handle?: string;
  appPassword?: string;
  pdsUrl?: string;
  // OAuth path (frontend-verified)
  verifiedDid?: string;
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

function errorResponse(origin: string, message: string, status: number) {
  return Response.json({ error: message }, { status, headers: corsHeaders(origin) });
}

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
    return errorResponse(origin, "Invalid request body.", 400);
  }

  let did: string;

  if (body.verifiedDid) {
    // OAuth path — frontend verified the session via DPoP fetchHandler
    did = body.verifiedDid;
  } else if (body.handle && body.appPassword) {
    // App password path
    const userAgent = new BskyAgent({ service: body.pdsUrl || DEFAULT_PDS });
    try {
      await userAgent.login({ identifier: body.handle, password: body.appPassword });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
        return errorResponse(origin, "Couldn't reach your PDS. Check the URL in Advanced settings and try again.", 503);
      }
      return errorResponse(origin, "Invalid credentials. If your account isn't on Bluesky, make sure to set your server under Advanced.", 401);
    }
    did = userAgent.session!.did;
  } else {
    return errorResponse(origin, "Missing required fields.", 400);
  }

  // Query the labeller service for active labels on this DID
  try {
    const serviceUrl = env.LABELLER_SERVICE_URL.replace(/\/$/, "");
    const url = `${serviceUrl}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(did)}&sources=${encodeURIComponent(env.LABELLER_DID)}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (err: any) {
      console.error("Ozone unreachable:", err);
      return errorResponse(origin, "The labeller service is currently unreachable. Please try again later.", 503);
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`queryLabels HTTP ${res.status}:`, text);
      return errorResponse(origin, "The labeller service returned an error. Please try again later.", 500);
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
    console.error("queryLabels failed unexpectedly:", err);
    return errorResponse(origin, "Something went wrong fetching your labels. Please try again.", 500);
  }
};