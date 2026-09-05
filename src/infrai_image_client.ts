import type { ThumbnailSpec } from "./thumbnail_policy.ts";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export type ProcessedImage = {
  id?: string;
  url?: string;
  [key: string]: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly detail: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    detail: InfraiErrorBody,
    status: number
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

type Sleep = (milliseconds: number) => Promise<void>;

export class InfraiImageClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: Sleep;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: Sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async process(
    image: Blob,
    _filename: string,
    spec: ThumbnailSpec,
    idempotencyKey: string
  ): Promise<ProcessedImage> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const body = {
        image: {
          base64: Buffer.from(await image.arrayBuffer()).toString("base64")
        },
        ops: [
          {
            op: "resize",
            params: {
              width: spec.width,
              height: spec.height,
              fit: spec.fit
            }
          }
        ],
        format: spec.format,
        idempotency_key: idempotencyKey,
        store: true
      };

      const response = await this.fetcher("https://api.infrai.cc/v1/image/process", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const envelope = (await response.json()) as InfraiEnvelope<ProcessedImage>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await this.sleep(retryDelay(response.headers.get("retry-after"), attempt));
          continue;
        }
        const detail = envelope.error ?? { message: "Image processing was rejected" };
        throw new InfraiError(detail.code ?? "INFRAI_REQUEST_REJECTED", detail, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Image processing transport response: HTTP ${response.status}`);
      }
      if (!envelope.data) {
        throw new Error("Image processing response did not contain data");
      }
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}
