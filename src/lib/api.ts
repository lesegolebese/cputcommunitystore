// Thin browser client for the /api/* endpoints. The JWT is kept in sessionStorage so it
// disappears when the tab closes (safer than localStorage on shared lab computers).
const KEY = "cs_token";

export const getToken = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null): void => {
  try {
    if (t) sessionStorage.setItem(KEY, t);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode) — user simply logs in again next visit */
  }
};

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith("auth/")) {
      setToken(null);
      window.dispatchEvent(new Event("cs-logout"));
    }
    throw new ApiError(typeof data["error"] === "string" ? data["error"] : "Request failed", res.status, data);
  }
  return data as T;
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong");

/** Read a chosen image file as a data URL, refusing anything over `maxBytes`. */
export function readImage(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error("Use a PNG, JPEG or WebP image"));
    if (file.size > maxBytes) return reject(new Error(`Image must be under ${Math.round(maxBytes / 1024)} KB`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
}
