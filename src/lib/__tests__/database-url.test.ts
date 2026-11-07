import { describe, expect, it } from "vitest";
import { databaseUrls } from "../database-url";

const prod = { DATABASE_URL: "prod-pool", DATABASE_URL_UNPOOLED: "prod-direct" };
const staging = { DATABASE_URL_STAGING: "stg-pool", DATABASE_URL_UNPOOLED_STAGING: "stg-direct" };

describe("databaseUrls", () => {
  it("uses the production database outside staging", () => {
    expect(databaseUrls({ ...prod, ...staging, VERCEL_GIT_COMMIT_REF: "main" })).toEqual({ pooled: "prod-pool", direct: "prod-direct" });
  });

  it("uses the staging database on the staging branch", () => {
    expect(databaseUrls({ ...prod, ...staging, VERCEL_GIT_COMMIT_REF: "staging" })).toEqual({ pooled: "stg-pool", direct: "stg-direct" });
    expect(databaseUrls({ ...prod, ...staging, APP_ENV: "staging" })).toEqual({ pooled: "stg-pool", direct: "stg-direct" });
  });

  it("never migrates production from staging when the unpooled staging URL is missing", () => {
    expect(databaseUrls({ ...prod, DATABASE_URL_STAGING: "stg-pool", VERCEL_GIT_COMMIT_REF: "staging" }).direct).toBe("stg-pool");
  });

  it("falls back to the normal names when no staging URL is set", () => {
    expect(databaseUrls({ ...prod, VERCEL_GIT_COMMIT_REF: "staging" })).toEqual({ pooled: "prod-pool", direct: "prod-direct" });
  });
});
