import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiImageClient } from "./infrai_image_client.ts";
import { thumbnailSpecFor } from "./thumbnail_policy.ts";
import { thumbnailRequestSchema } from "./thumbnail_request.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiImageClient(apiKey);
const port = Number(process.env.PORT ?? "3000");
const maxBodyBytes = 12 * 1024 * 1024;

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/thumbnails") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const raw = await readBody(request, maxBodyBytes);
    const input = thumbnailRequestSchema.parse(JSON.parse(raw));
    const bytes = Buffer.from(input.imageBase64, "base64");
    const spec = thumbnailSpecFor(input.kind);
    const image = new Blob([bytes], { type: input.contentType });
    const processed = await client.process(image, input.filename, spec, input.requestId);

    sendJson(response, 201, {
      kind: input.kind,
      requestId: input.requestId,
      thumbnail: processed,
      spec
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.message, code: error.code });
      return;
    }
    sendJson(response, 502, { error: "Thumbnail processing failed" });
  }
}).listen(port, () => {
  console.log(`thumbnail service listening on http://localhost:${port}`);
});

async function readBody(request: AsyncIterable<Buffer>, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new SyntaxError("Request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
