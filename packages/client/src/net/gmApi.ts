export async function gmFetch(path: string, sessionToken: string, init?: RequestInit) {
  const jsonBody = typeof init?.body === "string";
  const res = await fetch(path, {
    ...init,
    headers: {
      "X-Session-Token": sessionToken,
      ...(jsonBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error ?? `Request failed (${res.status})`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
