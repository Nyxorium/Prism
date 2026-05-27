import { BskyAgent } from "@atproto/api";
import { LABEL_IDS } from "../../src/labels";

interface LabelRequest {
  handle: string;
  appPassword: string;
  pdsUrl?: string;
  label: string;
  action: "add" | "remove";
}

interface Env {
  LABELLER_DID: string;
  LABELLER_HANDLE: string;
  LABELLER_APP_PASSWORD: string;
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

  let body: LabelRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(origin, "Invalid request body.", 400);
  }

  const { handle, appPassword, pdsUrl, label, action } = body;

  if (!handle || !appPassword || !label || !action) {
    return errorResponse(origin, "Missing required fields.", 400);
  }

  if (!["add", "remove"].includes(action)) {
    return errorResponse(origin, "Invalid action.", 400);
  }

  if (!LABEL_IDS.has(label)) {
    return errorResponse(origin, "That label isn't supported.", 400);
  }

  // Verify user identity against their PDS
  const userAgent = new BskyAgent({ service: pdsUrl || DEFAULT_PDS });
  try {
    await userAgent.login({ identifier: handle, password: appPassword });
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
      console.error("PDS unreachable:", pdsUrl, err);
      return errorResponse(origin, "Couldn't reach your PDS. Check the URL in Advanced settings and try again.", 503);
    }
    return errorResponse(origin, "Invalid credentials. If your account isn't on Bluesky, make sure to set your provider under Advanced.", 401);
  }

  const verifiedDid = userAgent.session!.did;

  // Log in as the labeller
  const labellerAgent = new BskyAgent({ service: "https://bsky.social" });
  try {
    await labellerAgent.login({
      identifier: env.LABELLER_HANDLE,
      password: env.LABELLER_APP_PASSWORD,
    });
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
      console.error("Labeller PDS unreachable:", err);
      return errorResponse(origin, "The labeller service is currently unreachable. Please try again later.", 503);
    }
    console.error("Labeller auth failed:", err);
    return errorResponse(origin, "The labeller service is misconfigured. Please contact the administrator.", 500);
  }

  // Apply or remove the label
  try {
    await labellerAgent
      .withProxy("atproto_labeler", env.LABELLER_DID)
      .api.tools.ozone.moderation.emitEvent({
        event: {
          $type: "tools.ozone.moderation.defs#modEventLabel",
          createLabelVals: action === "add" ? [label] : [],
          negateLabelVals: action === "remove" ? [label] : [],
        },
        subject: {
          $type: "com.atproto.admin.defs#repoRef",
          did: verifiedDid,
        },
        createdBy: labellerAgent.session!.did,
        createdAt: new Date().toISOString(),
        subjectBlobCids: [],
      });
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
      console.error("Ozone unreachable:", err);
      return errorResponse(origin, "The labeller service is currently unreachable. Please try again later.", 503);
    }
    console.error("emitEvent failed:", err);
    return errorResponse(origin, "The labeller service returned an error. Please try again later.", 500);
  }

  return Response.json(
    { success: true, did: verifiedDid, label, action },
    { status: 200, headers: corsHeaders(origin) }
  );
};