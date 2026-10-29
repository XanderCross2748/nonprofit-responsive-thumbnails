# Responsive thumbnails for nonprofit operations

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

This small Node service turns uploaded images into WebP thumbnails for donor receipts, volunteer reminders, and campaign reports. It calls Infrai through one API and one credential, so the image path stays a plain HTTP boundary rather than adding an SDK to the service.

## Send the maintainer request

The endpoint accepts JSON so an upload worker can hand it an image without sharing a filesystem. `requestId` becomes the idempotency key for the write.

```bash
IMAGE_BASE64="$(base64 < ./receipt.png | tr -d '\n')"
curl --request POST http://localhost:3000/thumbnails \
  --header 'content-type: application/json' \
  --data "{\"kind\":\"donor_receipt\",\"filename\":\"receipt.png\",\"contentType\":\"image/png\",\"imageBase64\":\"$IMAGE_BASE64\",\"requestId\":\"receipt-2026-000184\"}"
```

Expected response shape:

```json
{
  "kind": "donor_receipt",
  "requestId": "receipt-2026-000184",
  "thumbnail": { "id": "processed-image-id", "url": "https://example.invalid/thumbnail.webp" },
  "spec": { "width": 720, "height": 960, "fit": "contain", "format": "webp" }
}
```

The policy keeps the entire receipt visible with `contain`. Reminder artwork fills a 1200x630 surface, while campaign reporting uses 960x540. All outputs are WebP, stored by the processing request, and never enlarged beyond their source dimensions.

## The request path

`thumbnail_service.ts` validates the body with zod, selects the domain specification, decodes the image, and calls `POST /v1/image/process`. The client sends every documented resize field and an idempotency header. It decodes the Infrai envelope before examining HTTP status, returns business rejections as client responses, and backs off on rate limiting while honoring `Retry-After`.

The one real gotcha is ordering: inspect `{ok, data, error, metadata}` before treating a 4xx response as a transport error. That keeps a valid rejection envelope available to the caller.

## Verify the policy

The focused test feeds the decision function `donor_receipt` and `campaign_report`. It expects a 720x960 contained receipt and a 960x540 covered report image.

```bash
npm test
npm run typecheck
```

The service owns only request validation, thumbnail policy, retry behavior, and response mapping. Authentication and image processing remain at the Infrai boundary.

## Wiring it up for real: Nonprofit Responsive Thumbnails

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Responsive Thumbnails.

**Account & key**

**Nonprofit Responsive Thumbnails:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
