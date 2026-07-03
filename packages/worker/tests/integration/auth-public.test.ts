import { createExecutionContext, env as testEnv } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_ACCESS_RULES_KEY } from "../../src/modules/buckets/publicAccess";
import { createTestApp, createTestRequest } from "./setup";

describe("Admin auth and public file gateway", () => {
	it("serves the admin shell when API token auth is configured", async () => {
		const app = createTestApp({ apiToken: "super-secret" });
		const response = await app.fetch(
			createTestRequest("/admin"),
			{
				...testEnv,
				ASSETS: {
					fetch: vi.fn().mockResolvedValue(new Response("dashboard")),
				} as any,
			},
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		await expect(response.text()).resolves.toBe("dashboard");
	});

	it("denies API access without a valid API token", async () => {
		const app = createTestApp({ apiToken: "super-secret" });
		const response = await app.fetch(
			createTestRequest("/api/server/config"),
			testEnv,
			createExecutionContext(),
		);

		expect(response.status).toBe(401);
		await expect(response.text()).resolves.toContain("Authentication required");
	});

	it("serves public files from R2 for GET requests", async () => {
		const app = createTestApp({ apiToken: "super-secret" });
		const object = {
			body: new Response("playlist-content").body,
			httpEtag: "etag-1",
			size: 15,
			writeHttpMetadata: vi.fn(),
		};
		const bucket = {
			get: vi.fn((key) => {
				if (key === PUBLIC_ACCESS_RULES_KEY) {
					return Promise.resolve({
						text: () =>
							Promise.resolve(
								JSON.stringify({
									defaultPublic: false,
									rules: { "live/": "public" },
								}),
							),
					});
				}

				return Promise.resolve(object);
			}),
		};

		const response = await app.fetch(
			createTestRequest("/live/cn/iptv.txt"),
			{ ...testEnv, ASSETS: { fetch: vi.fn() } as any, R2: bucket as any },
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		await expect(response.text()).resolves.toBe("playlist-content");
		expect(response.headers.get("cache-control")).toContain("max-age=300");
		expect(response.headers.get("content-disposition")).toContain("inline");
	});
});
