export const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:5000";

export function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API}${p}`;
  
}
export async function fetchJson<T = any>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = apiUrl(path);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  console.log("fetch ->", url);

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error(`HTTP ${res.status} - ${msg || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function downloadFromResponse(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const cd = res.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);

  a.href = url;
  a.download = m?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function safeText(r: Response) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}
                                                                                                                                               