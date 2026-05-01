/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    FILE_BUCKET: R2Bucket;
    JWT_SECRET: string;
  }
}
export {};
