export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  readonly baseUrl: string;
  private readonly apiToken?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiToken = opts.apiToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined | null>;
      auth?: boolean;
    } = {}
  ): Promise<T> {
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v === undefined || v === null || v === "") continue;
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const useAuth = options.auth !== false;
    if (useAuth) {
      if (!this.apiToken) {
        throw new ApiRequestError(
          401,
          "UNAUTHORIZED",
          "Not authenticated. Run `clawkpit connect <email>` or set CLAWKPIT_API_TOKEN."
        );
      }
      headers.Authorization = `Bearer ${this.apiToken}`;
    }

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!res.ok) {
      const payload = (data ?? {}) as ApiErrorPayload;
      const code = payload.error?.code || (res.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR");
      const message =
        payload.error?.message ||
        (typeof data === "object" && data && "error" in data && typeof (data as { error: unknown }).error === "string"
          ? ((data as { error: string }).error)
          : `HTTP ${res.status}`);
      throw new ApiRequestError(res.status, code, message, payload.error?.details);
    }

    return data as T;
  }

  get<T = unknown>(path: string, query?: ApiClient["request"] extends never ? never : Record<string, string | number | boolean | undefined | null>, auth = true) {
    return this.request<T>("GET", path, { query, auth });
  }

  post<T = unknown>(path: string, body?: unknown, auth = true) {
    return this.request<T>("POST", path, { body, auth });
  }

  patch<T = unknown>(path: string, body?: unknown, auth = true) {
    return this.request<T>("PATCH", path, { body, auth });
  }
}
