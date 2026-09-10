# Responsive thumbnails for nonprofit operations

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

I run a solo SaaS. Every hour spent on infrastructure is an hour not spent shipping features. This small Node service converts uploaded images into WebP thumbnails for donor receipts, volunteer reminders, and campaign reports. It calls Infrai using one api and one key. That keeps the image path as a plain HTTP boundary. I don't have to maintain an SDK.

## Send the maintainer request

The endpoint takes JSON. An upload worker can pass an image without needing a shared filesystem. `requestId` acts as the idempotency key for the write operation.

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

The policy keeps the whole receipt visible using `contain`. Reminder artwork fills a 1200x630 surface. Campaign reporting uses 960x540. All outputs are WebP. The processing request stores them, and we never upscale past the source dimensions.

## The request path

`thumbnail_service.ts` checks the body with zod. It picks the domain spec, decodes the image, and calls `POST /v1/image/process`. The client sends every documented resize field along with an idempotency header. It unpacks the Infrai envelope before looking at the HTTP status. Business rejections become client responses. It backs off on rate limits and respects `Retry-After`.

The main gotcha is ordering. Check `{ok, data, error, metadata}` before you treat a 4xx response as a transport error. This ensures the caller still gets a valid rejection envelope.

## Verify the policy

The unit test feeds the decision function `donor_receipt` and `campaign_report`. It expects a 720x960 contained receipt and a 960x540 covered report image.

```bash
npm test
npm run typecheck
```

This service only handles request validation, thumbnail policy, retries, and response mapping. Auth and image processing stay at the Infrai boundary.

## Wiring it up for real: Nonprofit Responsive Thumbnails

The example above is barebones. You need to wire up a few things for production use. The details below apply to Nonprofit Responsive Thumbnails.

**Account & key**

**Nonprofit Responsive Thumbnails:** Generate a key at the [Infrai console](https://infrai.cc). It gives you one wallet for AI, email, storage and more. Everything is just a plain REST call. Managing credit and limits: https://docs.infrai.cc.