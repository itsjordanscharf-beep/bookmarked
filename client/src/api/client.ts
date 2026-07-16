export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle(res: Response) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "Something went wrong");
  return data;
}

export const api = {
  get: (path: string) => fetch(`/api${path}`, { credentials: "include" }).then(handle),
  post: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
  put: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
};

// Friend/viewer requests are authenticated with a per-share token instead of
// the owner's session cookie, since friends never create an account.
export const viewerApi = {
  get: (path: string, token: string) =>
    fetch(`/api${path}`, { headers: { "X-Viewer-Token": token } }).then(handle),
  post: (path: string, token: string | null, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Viewer-Token": token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
  put: (path: string, token: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Viewer-Token": token },
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
};

export interface ViewerSession {
  viewerId: string;
  viewerToken: string;
  displayName: string;
}

const viewerKey = (code: string) => `bookmarked_viewer_${code}`;

export function getViewerSession(code: string): ViewerSession | null {
  const raw = localStorage.getItem(viewerKey(code));
  return raw ? JSON.parse(raw) : null;
}

export function saveViewerSession(code: string, session: ViewerSession) {
  localStorage.setItem(viewerKey(code), JSON.stringify(session));
}
