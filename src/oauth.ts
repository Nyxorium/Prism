import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

export const oauthClient = new BrowserOAuthClient({
  clientMetadata: {
    client_id: `${window.location.origin}/client-metadata.json`,
    client_name: "PrideLabeller",
    client_uri: window.location.origin,
    redirect_uris: [`${window.location.origin}/oauth/callback`],
    scope: "atproto",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    application_type: "web",
    dpop_bound_access_tokens: true,
  },
  handleResolver: "https://bsky.social",
});