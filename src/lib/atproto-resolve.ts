interface DidDocument {
  id: string;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export class ResolveError extends Error {}

// Bluesky's own PDS shards (*.host.bsky.network) proxy auth through the
// stable bsky.social Entryway — normalize to that instead of the raw shard.
// https://docs.bsky.app/docs/advanced-guides/entryway
const BSKY_HOSTED_SUFFIX = ".host.bsky.network";
const BSKY_ENTRYWAY = "https://bsky.social";

function normalizePds(serviceEndpoint: string): string {
  try {
    const { hostname } = new URL(serviceEndpoint);
    if (hostname.endsWith(BSKY_HOSTED_SUFFIX)) return BSKY_ENTRYWAY;
  } catch {
    /* not a valid URL somehow; return as-is and let the caller's fetch fail visibly */
  }
  return serviceEndpoint;
}

/** Resolve a handle to a DID. Tries the public AppView first, then DNS-over-HTTPS, then .well-known. */
export async function resolveHandleToDid(handle: string): Promise<string> {
  handle = handle.trim().replace(/^@/, "");

  // 1. Public AppView — covers the vast majority of accounts, including most
  //    self-hosted PDSes since they still get indexed.
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    if (res.ok) {
      const { did } = (await res.json()) as { did: string };
      if (did) return did;
    }
  } catch {
    /* fall through */
  }

  // 2. DNS-over-HTTPS TXT lookup for _atproto.<handle>
  try {
    const dohRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_atproto.${handle}&type=TXT`,
      { headers: { accept: "application/dns-json" } }
    );
    if (dohRes.ok) {
      const data = (await dohRes.json()) as { Answer?: Array<{ data: string }> };
      const record = data.Answer?.find(a => a.data.includes("did="));
      if (record) {
        // TXT data comes back quoted, e.g. "\"did=did:plc:abc123\""
        const match = record.data.replace(/^"|"$/g, "").match(/did=(.+)/);
        if (match) return match[1];
      }
    }
  } catch {
    /* fall through */
  }

  // 3. HTTPS well-known fallback
  try {
    const wellKnownRes = await fetch(`https://${handle}/.well-known/atproto-did`);
    if (wellKnownRes.ok) {
      const did = (await wellKnownRes.text()).trim();
      if (did.startsWith("did:")) return did;
    }
  } catch {
    /* fall through */
  }

  throw new ResolveError(`Couldn't resolve "${handle}" to an account.`);
}

/** Resolve a DID to its PDS service endpoint. */
export async function resolveDidToPds(did: string): Promise<string> {
  let doc: DidDocument;

  if (did.startsWith("did:web:")) {
    const domain = did.slice("did:web:".length).replace(/:/g, "/");
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw new ResolveError(`Couldn't look up the account's PDS.`);
    doc = await res.json();
  } else if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw new ResolveError(`Couldn't look up the account's PDS.`);
    doc = await res.json();
  } else {
    throw new ResolveError(`Unsupported account identifier type.`);
  }

  const pds = doc.service?.find(s => s.id === "#atproto_pds");
  if (!pds) throw new ResolveError(`Couldn't find a PDS for this account.`);
  return normalizePds(pds.serviceEndpoint);
}

/** Full chain: handle or DID -> PDS URL. */
export async function resolveToPds(identifier: string): Promise<string> {
  const did = identifier.startsWith("did:") ? identifier : await resolveHandleToDid(identifier);
  return resolveDidToPds(did);
}