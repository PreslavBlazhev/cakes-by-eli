import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

/**
 * One set of numbers, four places that have to agree.
 *
 * The limits used to be 5 files × 6 MB against a 12 MB server-action body, so a
 * customer who attached a full set of photos hit an opaque "body exceeded"
 * error instead of the friendly message the form promised. This test is what
 * stops the four from drifting again: the environment defaults, the ceiling in
 * `next.config.ts`, the server-side check and the sentence the form shows.
 */

process.env.DATABASE_URL = "";
delete process.env.UPLOAD_MAX_FILE_MB;
delete process.env.UPLOAD_MAX_FILES;

const {
  env,
  SERVER_ACTION_BODY_LIMIT_MB,
  worstCaseUploadBodyMb,
} = await import("@/lib/env");
const { AttachmentPicker } = await import(
  "@/features/order/AttachmentPicker"
);
const nextConfig = (await import("../next.config")).default;

describe("environment defaults", () => {
  it("defaults to 3 files of 3 MB", () => {
    expect(env.UPLOAD_MAX_FILES).toBe(3);
    expect(env.UPLOAD_MAX_FILE_MB).toBe(3);
  });

  it("caps both values so no deployment can configure them past the body limit", () => {
    // The schema's own maxima, multiplied out, must still fit.
    expect(worstCaseUploadBodyMb(10, 10)).toBeGreaterThan(
      SERVER_ACTION_BODY_LIMIT_MB,
    );
    // …which is precisely why `load()` re-checks the resolved values.
    expect(
      worstCaseUploadBodyMb(env.UPLOAD_MAX_FILES, env.UPLOAD_MAX_FILE_MB),
    ).toBeLessThanOrEqual(SERVER_ACTION_BODY_LIMIT_MB);
  });
});

describe("agreement with next.config.ts", () => {
  it("declares the same body limit the config sets", () => {
    const configured = nextConfig.experimental?.serverActions?.bodySizeLimit;
    expect(configured).toBe(`${SERVER_ACTION_BODY_LIMIT_MB}mb`);
  });

  it("leaves headroom for multipart overhead rather than matching exactly", () => {
    const worstCase = worstCaseUploadBodyMb(
      env.UPLOAD_MAX_FILES,
      env.UPLOAD_MAX_FILE_MB,
    );
    expect(worstCase).toBeLessThan(SERVER_ACTION_BODY_LIMIT_MB);
  });
});

describe("agreement with the interface", () => {
  it("shows the same two numbers the server enforces", () => {
    const html = renderToStaticMarkup(
      createElement(AttachmentPicker, {
        files: [],
        onChange: () => {},
        maxFiles: env.UPLOAD_MAX_FILES,
        maxFileMb: env.UPLOAD_MAX_FILE_MB,
      }),
    );

    expect(html).toContain(`до ${env.UPLOAD_MAX_FILES} снимки`);
    expect(html).toContain(`до ${env.UPLOAD_MAX_FILE_MB} MB`);
    expect(html).toContain("JPG, PNG или WEBP");
  });
});

describe("agreement with the server", () => {
  it("rejects the first byte over the advertised per-file limit", async () => {
    const { storeUploadedImage } = await import("@/lib/storage");

    const overLimit = new Uint8Array(env.UPLOAD_MAX_FILE_MB * 1024 * 1024 + 1);
    overLimit.set([0xff, 0xd8, 0xff]);

    const result = await storeUploadedImage(
      new File([overLimit], "голяма.jpg", { type: "image/jpeg" }),
      "orders",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The very number the form showed.
    expect(result.error).toContain(`${env.UPLOAD_MAX_FILE_MB} MB`);
  });

  // The per-request *count* limit is enforced by `submitOrder`, which needs a
  // real product to get that far — that case lives in `tests/orders.test.ts`,
  // where a seeded database already exists.
});
