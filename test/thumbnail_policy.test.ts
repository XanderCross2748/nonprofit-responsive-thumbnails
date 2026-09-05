import assert from "node:assert/strict";
import test from "node:test";
import { thumbnailSpecFor } from "../src/thumbnail_policy.ts";

test("receipt thumbnails preserve the full document while campaign media fills widescreen", () => {
  assert.deepEqual(thumbnailSpecFor("donor_receipt"), {
    width: 720,
    height: 960,
    fit: "contain",
    format: "webp"
  });
  assert.deepEqual(thumbnailSpecFor("campaign_report"), {
    width: 960,
    height: 540,
    fit: "cover",
    format: "webp"
  });
});
