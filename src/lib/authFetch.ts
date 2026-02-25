/**
 * Wrapper around fetch that includes the Clerk session token
 * for authenticated API requests.
 */
export async function authFetch(
  getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
