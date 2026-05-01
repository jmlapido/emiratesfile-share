import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function getBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.FILE_BUCKET;
}
