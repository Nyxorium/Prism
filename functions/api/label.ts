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
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
  }

  const { handle, appPassword, pdsUrl, label, action } = body;

  if (!handle || !appPassword || !label || !action) {
    return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders(origin) });
  }

  if (!["add", "remove"].includes(action)) {
    return Response.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders(origin) });
  }

  if (!LABEL_IDS.has(label)) {
    return Response.json({ error: "Label not permitted" }, { status: 400, headers: corsHeaders(origin) });
  }

  // Verify user identity against their PDS
  const userAgent = new BskyAgent({ service: pdsUrl || DEFAULT_PDS });
  try {
    await userAgent.login({ identifier: handle, password: appPassword });
  } catch {
    return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders(origin) });
  }

  const verifiedDid = userAgent.session!.did;

  // Log in as the labeller
  const labellerAgent = new BskyAgent({ service: "https://bsky.social" });
  try {
    await labellerAgent.login({
      identifier: env.LABELLER_HANDLE,
      password: env.LABELLER_APP_PASSWORD,
    });
  } catch {
    return Response.json({ error: "Labeller auth failed" }, { status: 500, headers: corsHeaders(origin) });
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
  } catch (err) {
    console.error("emitEvent failed:", err);
    return Response.json({ error: "Failed to apply label" }, { status: 500, headers: corsHeaders(origin) });
  }

  return Response.json(
    { success: true, did: verifiedDid, label, action },
    { status: 200, headers: corsHeaders(origin) }
  );
};