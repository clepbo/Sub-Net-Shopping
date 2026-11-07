// Which database to use. Production uses DATABASE_URL / DATABASE_URL_UNPOOLED.
// The staging deployment (Vercel branch "staging", or APP_ENV=staging) uses
// DATABASE_URL_STAGING / DATABASE_URL_UNPOOLED_STAGING when they're set, so
// test data never lands in the live database. No imports: prisma.config.ts
// and scripts use this too.

type Env = Record<string, string | undefined>;

export function isStaging(env: Env = process.env) {
  return env.APP_ENV === "staging" || env.VERCEL_GIT_COMMIT_REF === "staging";
}

export function databaseUrls(env: Env = process.env): { pooled: string | undefined; direct: string | undefined } {
  if (isStaging(env) && env.DATABASE_URL_STAGING) {
    // Never fall back to a production URL for staging migrations.
    return { pooled: env.DATABASE_URL_STAGING, direct: env.DATABASE_URL_UNPOOLED_STAGING ?? env.DATABASE_URL_STAGING };
  }
  return { pooled: env.DATABASE_URL, direct: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL };
}
