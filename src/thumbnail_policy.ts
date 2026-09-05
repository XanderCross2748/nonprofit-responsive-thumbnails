export const imageKinds = ["donor_receipt", "volunteer_reminder", "campaign_report"] as const;

export type ImageKind = (typeof imageKinds)[number];

export type ThumbnailSpec = {
  width: number;
  height: number;
  fit: "cover" | "contain";
  format: "webp";
};

const specs: Record<ImageKind, ThumbnailSpec> = {
  donor_receipt: { width: 720, height: 960, fit: "contain", format: "webp" },
  volunteer_reminder: { width: 1200, height: 630, fit: "cover", format: "webp" },
  campaign_report: { width: 960, height: 540, fit: "cover", format: "webp" }
};

export function thumbnailSpecFor(kind: ImageKind): ThumbnailSpec {
  return specs[kind];
}
