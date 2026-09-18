import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET ?? "printer-platform";

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "change-me-minio",
  },
});

let bucketReady: Promise<void> | null = null;

async function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (error) {
        await client.send(new HeadBucketCommand({ Bucket: bucket })).catch(() => {
          throw error;
        });
      }
    }
  })();
  return bucketReady;
}

const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const photoTypes = new Set(["image/jpeg", "image/png"]);

async function uploadFile(file: File, keyPrefix: string, label = "附件", types: Set<string> = allowedTypes) {
  if (!file.size) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error(`${label}不能超过 10MB`);
  if (!types.has(file.type)) throw new Error(`${label}仅支持 ${label === "照片" ? "JPG 或 PNG" : "PDF、Word、JPG 或 PNG"}`);

  await ensureBucket();
  const extension = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const key = `${keyPrefix}/${randomUUID()}${extension}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      Metadata: { originalname: encodeURIComponent(file.name) },
    }),
  );
  return `/api/files/${key}`;
}

export async function uploadContractAttachment(file: File, side: "customer" | "supplier") {
  return uploadFile(file, `contracts/${side}`);
}

export async function uploadOrderAttachment(file: File, side: "customer" | "supplier") {
  return uploadFile(file, `orders/${side}`);
}

export async function uploadMeterPhoto(file: File) {
  return uploadFile(file, "meter-readings/photos", "照片", photoTypes);
}

export async function deleteAttachment(url: string | null | undefined) {
  const key = objectKeyFromUrl(url);
  if (!key) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
}

export function objectKeyFromUrl(url: string | null | undefined) {
  const prefix = "/api/files/";
  return url?.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function getAttachment(key: string) {
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}
