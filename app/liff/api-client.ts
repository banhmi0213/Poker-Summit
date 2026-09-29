// Thin fetch wrapper shared by every /liff/* client page. All it adds over
// plain fetch: attaches the LIFF ID token as a Bearer header, JSON-encodes
// non-FormData bodies, and turns a non-2xx response into a thrown
// LiffApiError carrying the server's Japanese message + status code (used
// by the dashboard to tell "not linked yet" (403) apart from other errors).
export class LiffApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LiffApiError";
    this.status = status;
  }
}

export async function liffFetch<T = unknown>(
  idToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${idToken}`,
      ...(options.headers ?? {}),
    },
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // No/invalid JSON body (e.g. a 204 or a non-API error page).
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `通信に失敗しました。(${res.status})`;
    throw new LiffApiError(message, res.status);
  }

  return data as T;
}
