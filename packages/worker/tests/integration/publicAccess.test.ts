import { createExecutionContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp, createTestRequest } from "./setup";

const BUCKET_NAME = "R2";
const TEST_KEY = "public-access-test.txt";
const TEST_CONTENT = "public access works";

describe("Public object access rules", () => {
	let app: ReturnType<typeof createTestApp>;
	let bucket: R2Bucket;

	beforeEach(async () => {
		app = createTestApp();
		bucket = env.R2;

		const listed = await bucket.list({ prefix: ".r2-explorer/" });
		const metadataKeys = listed.objects.map((obj) => obj.key);
		if (metadataKeys.length > 0) {
			await bucket.delete(metadataKeys);
		}

		await bucket.delete(TEST_KEY);
		await bucket.put(TEST_KEY, TEST_CONTENT, {
			httpMetadata: { contentType: "text/plain" },
		});
	});

	it("keeps root object URLs private by default", async () => {
		const response = await app.fetch(
			createTestRequest(`/${TEST_KEY}`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(404);
	});

	it("serves root object URLs after setting the file public", async () => {
		const encodedKey = btoa(TEST_KEY);
		const updateResponse = await app.fetch(
			createTestRequest(
				`/api/buckets/${BUCKET_NAME}/${encodedKey}/public-access`,
				"POST",
				{ access: "public" },
				{ "Content-Type": "application/json" },
			),
			env,
			createExecutionContext(),
		);
		expect(updateResponse.status).toBe(200);

		const response = await app.fetch(
			createTestRequest(`/${TEST_KEY}`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(TEST_CONTENT);
	});

	it("inherits folder public access for nested files", async () => {
		const nestedKey = "public-folder/nested.txt";
		await bucket.put(nestedKey, TEST_CONTENT, {
			httpMetadata: { contentType: "text/plain" },
		});

		const updateResponse = await app.fetch(
			createTestRequest(
				`/api/buckets/${BUCKET_NAME}/${btoa("public-folder/")}/public-access`,
				"POST",
				{ access: "public" },
				{ "Content-Type": "application/json" },
			),
			env,
			createExecutionContext(),
		);
		expect(updateResponse.status).toBe(200);

		const response = await app.fetch(
			createTestRequest(`/${nestedKey}`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe(TEST_CONTENT);
	});

	it("allows a private file to override a public folder", async () => {
		const nestedKey = "mixed-folder/private.txt";
		await bucket.put(nestedKey, TEST_CONTENT, {
			httpMetadata: { contentType: "text/plain" },
		});

		await app.fetch(
			createTestRequest(
				`/api/buckets/${BUCKET_NAME}/${btoa("mixed-folder/")}/public-access`,
				"POST",
				{ access: "public" },
				{ "Content-Type": "application/json" },
			),
			env,
			createExecutionContext(),
		);
		await app.fetch(
			createTestRequest(
				`/api/buckets/${BUCKET_NAME}/${btoa(nestedKey)}/public-access`,
				"POST",
				{ access: "private" },
				{ "Content-Type": "application/json" },
			),
			env,
			createExecutionContext(),
		);

		const response = await app.fetch(
			createTestRequest(`/${nestedKey}`),
			env,
			createExecutionContext(),
		);

		expect(response.status).toBe(404);
	});
});
