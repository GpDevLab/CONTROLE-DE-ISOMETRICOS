// api.ts
export function apiUrl(path: string) {
  return path.startsWith('http') ? path : `${process.env.NEXT_PUBLIC_API_URL || ''}${path}`;
}

// Busca o token JWT armazenado no cookie
function getToken(): string | null {
  return document.cookie.split('; ').find(row => row.startsWith('SGI_TOKEN='))?.split('=')[1] ?? null;
}

// Fetch JSON com token
export async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(apiUrl(url), { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    throw new Error(data?.erro || res.statusText);
  }
  return res.json();
}

// Fetch "raw" (blob) com token, útil para downloads
export async function fetchRaw(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  return fetch(apiUrl(url), { ...options, headers });
}

// Função de download a partir do Response
export async function downloadFromResponse(res: Response, filename: string) {
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
