/**
 * Phase 1 stub: passes through fetch without auth.
 *
 * Signature is preserved so existing callers (DocumentUpload, UploadDialog,
 * LandingPage, ConversationView) compile unchanged. The `getToken` parameter
 * is ignored in Phase 1. Phase 2 will delete this file and switch callers to
 * plain `fetch()` once `requireSession` replaces the per-call token model.
 */
export async function authFetch(
  _getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, init);
}
