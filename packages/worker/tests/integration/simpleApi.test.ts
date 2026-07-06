import { createExecutionContext, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createTestRequest } from "./setup";

describe("Simple API endpoints", () => {
	let bucket: R2Bucket;

	beforeEach(async () => {
		bucket = env.MY_TEST_BUCKET_1;
		const listed = await bucket.list();
		const keys = listed.objects.map((obj) => obj.key);
		if (keys.length > 0) {
			await bucket.delete(keys);
		}
	});

	afterEach(async () => {
		const listed = await bucket.list();
		const keys = listed.objects.map((obj) => obj.key);
		if (keys.length > 0) {
			await bucket.delete(keys);
		}
	});

	it("lists objects with default bucket and GET token query", async () => {
		await bucket.put("folder/demo.txt", "hello");
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const request = createTestRequest(
			"/api/list?prefix=folder/&token=test-token",
		);

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			success: boolean;
			data: R2Objects;
		};
		expect(body.success).toBe(true);
		expect(body.data.objects.map((obj) => obj.key)).toEqual([
			"folder/demo.txt",
		]);
	});

	it("rejects GET token query when token does not match", async () => {
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const request = createTestRequest("/api/list?token=wrong-token");

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(401);
	});

	it("uploads and downloads a file without bucket path segment", async () => {
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const uploadRequest = createTestRequest(
			"/api/upload?path=folder/demo.txt",
			"POST",
			new Blob(["hello from simple api"]),
			{
				Authorization: "Bearer test-token",
				"Content-Type": "text/plain",
			},
		);

		const uploadResponse = await app.fetch(
			uploadRequest,
			env,
			createExecutionContext(),
		);

		expect(uploadResponse.status).toBe(200);
		const uploaded = await bucket.get("folder/demo.txt");
		expect(await uploaded?.text()).toBe("hello from simple api");
		expect(uploaded?.httpMetadata.contentType).toBe("text/plain");

		const downloadRequest = createTestRequest(
			"/api/file?path=folder/demo.txt&token=test-token",
		);
		const downloadResponse = await app.fetch(
			downloadRequest,
			env,
			createExecutionContext(),
		);

		expect(downloadResponse.status).toBe(200);
		expect(await downloadResponse.text()).toBe("hello from simple api");
	});

	it("uploads multiple multipart files using category as the folder", async () => {
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const formData = new FormData();
		formData.set("source", "iptv-picker");
		formData.set("category", "live");
		formData.set("publicAccess", "public");
		formData.append(
			"files",
			new File(["#EXTM3U\n"], "iptv.m3u", {
				type: "application/vnd.apple.mpegurl",
			}),
		);
		formData.append(
			"files",
			new File(["channel list"], "iptv.txt", { type: "text/plain" }),
		);
		formData.append(
			"files",
			new File([JSON.stringify({ ok: true })], "iptv.json", {
				type: "application/json",
			}),
		);
		const request = new Request("http://localhost/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
			body: formData,
		});

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			data: {
				uploaded: { key: string; contentType: string; size: number }[];
				failed: unknown[];
			};
		};
		expect(body.data.failed).toEqual([]);
		expect(body.data.uploaded.map((file) => file.key)).toEqual([
			"live/iptv.m3u",
			"live/iptv.txt",
			"live/iptv.json",
		]);
		expect(body.data.uploaded[0].contentType).toBe(
			"application/vnd.apple.mpegurl",
		);

		const m3u = await bucket.get("live/iptv.m3u");
		const txt = await bucket.get("live/iptv.txt");
		const json = await bucket.get("live/iptv.json");
		expect(await m3u?.text()).toBe("#EXTM3U\n");
		expect(await txt?.text()).toBe("channel list");
		expect(await json?.json()).toEqual({ ok: true });
		expect(m3u?.httpMetadata.contentType).toBe("application/vnd.apple.mpegurl");
		expect(txt?.customMetadata).toEqual({
			source: "iptv-picker",
			category: "live",
		});

		const rulesObject = await bucket.get(
			".r2-explorer/permissions/public-rules.json",
		);
		const rules = (await rulesObject?.json()) as {
			rules: Record<string, string>;
		};
		expect(rules.rules["live/iptv.m3u"]).toBe("public");
		expect(rules.rules["live/iptv.txt"]).toBe("public");
		expect(rules.rules["live/iptv.json"]).toBe("public");
	});

	it("does not accept query token for POST requests", async () => {
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const request = createTestRequest(
			"/api/upload?path=folder/demo.txt&token=test-token",
			"POST",
			new Blob(["blocked"]),
			{ "Content-Type": "text/plain" },
		);

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(401);
		expect(await bucket.get("folder/demo.txt")).toBeNull();
	});

	it("uses optional bucket query when no default bucket is configured", async () => {
		const app = createTestApp({ apiToken: "test-token" });
		await bucket.put("demo.txt", "query bucket");
		const request = createTestRequest(
			"/api/file?bucket=MY_TEST_BUCKET_1&path=demo.txt&token=test-token",
		);

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("query bucket");
	});

	it("returns 400 when bucket is omitted and multiple buckets are configured", async () => {
		const app = createTestApp({ apiToken: "test-token" });
		const request = createTestRequest("/api/list?token=test-token");

		const response = await app.fetch(request, env, createExecutionContext());

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Bucket is required");
	});

	it("creates folder, moves, copies, updates metadata, sets public access, and deletes", async () => {
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const headers = {
			Authorization: "Bearer test-token",
			"Content-Type": "application/json",
		};

		const folderResponse = await app.fetch(
			createTestRequest("/api/folder", "POST", { path: "folder/" }, headers),
			env,
			createExecutionContext(),
		);
		expect(folderResponse.status).toBe(200);
		await folderResponse.json();
		expect(await bucket.head("folder/")).not.toBeNull();

		await bucket.put("folder/demo.txt", "hello");

		const moveResponse = await app.fetch(
			createTestRequest(
				"/api/move",
				"POST",
				{ from: "folder/demo.txt", to: "folder/renamed.txt" },
				headers,
			),
			env,
			createExecutionContext(),
		);
		expect(moveResponse.status).toBe(200);
		await moveResponse.json();
		expect(await bucket.get("folder/demo.txt")).toBeNull();
		expect(await bucket.head("folder/renamed.txt")).not.toBeNull();

		const copyResponse = await app.fetch(
			createTestRequest(
				"/api/copy",
				"POST",
				{ from: "folder/renamed.txt", to: "folder/copy.txt" },
				headers,
			),
			env,
			createExecutionContext(),
		);
		expect(copyResponse.status).toBe(200);
		await copyResponse.json();
		expect(await bucket.head("folder/copy.txt")).not.toBeNull();

		const metadataResponse = await app.fetch(
			createTestRequest(
				"/api/metadata",
				"POST",
				{
					path: "folder/copy.txt",
					httpMetadata: { contentType: "text/plain" },
					customMetadata: { source: "simple-api" },
				},
				headers,
			),
			env,
			createExecutionContext(),
		);
		expect(metadataResponse.status).toBe(200);
		await metadataResponse.json();
		const objectHead = await bucket.head("folder/copy.txt");
		expect(objectHead?.customMetadata).toEqual({ source: "simple-api" });

		const publicResponse = await app.fetch(
			createTestRequest(
				"/api/public-access",
				"POST",
				{ path: "folder/copy.txt", access: "public" },
				headers,
			),
			env,
			createExecutionContext(),
		);
		expect(publicResponse.status).toBe(200);
		const publicBody = (await publicResponse.json()) as {
			data: { effectiveAccess: string };
		};
		expect(publicBody.data.effectiveAccess).toBe("public");

		const deleteResponse = await app.fetch(
			createTestRequest(
				"/api/delete",
				"POST",
				{ path: "folder/copy.txt" },
				headers,
			),
			env,
			createExecutionContext(),
		);
		expect(deleteResponse.status).toBe(200);
		await deleteResponse.json();
		expect(await bucket.get("folder/copy.txt")).toBeNull();
	});

	it("creates, lists, and revokes a share link", async () => {
		await bucket.put("folder/share.txt", "share me");
		const app = createTestApp({
			apiToken: "test-token",
			defaultBucket: "MY_TEST_BUCKET_1",
		});
		const headers = {
			Authorization: "Bearer test-token",
			"Content-Type": "application/json",
		};

		const createResponse = await app.fetch(
			createTestRequest(
				"/api/share",
				"POST",
				{
					path: "folder/share.txt",
					expiresIn: 3600,
					password: "secret",
					maxDownloads: 2,
				},
				headers,
			),
			env,
			createExecutionContext(),
		);

		expect(createResponse.status).toBe(200);
		const createBody = (await createResponse.json()) as {
			data: { shareId: string; shareUrl: string };
		};
		expect(createBody.data.shareUrl).toContain(
			`/share/${createBody.data.shareId}`,
		);

		const listResponse = await app.fetch(
			createTestRequest("/api/shares?token=test-token"),
			env,
			createExecutionContext(),
		);
		expect(listResponse.status).toBe(200);
		const listBody = (await listResponse.json()) as {
			data: { shares: { shareId: string }[] };
		};
		expect(listBody.data.shares.map((share) => share.shareId)).toContain(
			createBody.data.shareId,
		);

		const deleteResponse = await app.fetch(
			createTestRequest(
				`/api/share?id=${createBody.data.shareId}`,
				"DELETE",
				undefined,
				{
					Authorization: "Bearer test-token",
				},
			),
			env,
			createExecutionContext(),
		);
		expect(deleteResponse.status).toBe(200);
	});
});
