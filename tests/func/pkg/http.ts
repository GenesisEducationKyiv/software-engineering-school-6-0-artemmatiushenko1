let _baseUrl = '';

export function setBaseUrl(url: string): void {
  _baseUrl = url;
}

export function getBaseUrl(): string {
  return _baseUrl;
}

export async function apiRequest(
  method: string,
  path: string,
  opts: { body?: unknown } = {},
): Promise<Response> {
  return fetch(`${_baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}
