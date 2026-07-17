import path from "path";

/**
 * Local JSON / upload persistence.
 * On Vercel the app filesystem is read-only — use /tmp instead of cwd/.data.
 */
export function getDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "marketing-hub-v2", ".data");
  }
  return path.join(process.cwd(), ".data");
}
