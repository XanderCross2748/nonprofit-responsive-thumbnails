import { z } from "zod";
import { imageKinds } from "./thumbnail_policy.ts";

export const thumbnailRequestSchema = z.object({
  kind: z.enum(imageKinds),
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().regex(/^image\/[a-z0-9.+-]+$/i),
  imageBase64: z.string().min(1),
  requestId: z.string().trim().min(8).max(128)
}).strict();

export type ThumbnailRequest = z.infer<typeof thumbnailRequestSchema>;
