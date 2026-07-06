import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppContext, AppEnv, AppVariables, ShareMetadata } from "../types";
import {
	getEffectivePublicAccess,
	loadPublicAccessRules,
	normalizeR2Key,
	savePublicAccessRules,
} from "./buckets/publicAccess";

type App = Hono<{ Bindings: AppEnv; Variables: AppVariables }>;

const SHARE_LINKS_PREFIX = ".r2-explorer/sharable-links/";

type UploadFormFile = File & {
	stream(): ReadableStream;
};

function isR2BucketBinding(value: unknown): value is R2Bucket {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as R2Bucket).get === "function" &&
		typeof (value as R2Bucket).put === "function" &&
		typeof (value as R2Bucket).list === "function"
	);
}

function getBucketNameFromRequest(
	c: AppContext,
	body?: Record<string, unknown>,
) {
	return (
		c.req.query("bucket") ||
		(typeof body?.bucket === "string" ? body.bucket : undefined) ||
		c.get("config").defaultBucket ||
		c.env.DEFAULT_BUCKET
	);
}

function resolveBucket(c: AppContext, body?: Record<string, unknown>) {
	const requestedBucket = getBucketNameFromRequest(c, body);
	if (requestedBucket) {
		const bucket = c.env[requestedBucket];
		if (isR2BucketBinding(bucket)) {
			return { bucketName: requestedBucket, bucket };
		}

		throw new HTTPException(500, {
			message: `Bucket binding not found: ${requestedBucket}`,
		});
	}

	const buckets = Object.entries(c.env).filter(
		([key, value]) => key !== "ASSETS" && isR2BucketBinding(value),
	) as [string, R2Bucket][];

	if (buckets.length === 1) {
		const [bucketName, bucket] = buckets[0];
		return { bucketName, bucket };
	}

	throw new HTTPException(400, {
		message:
			"Bucket is required when multiple R2 bucket bindings are configured",
	});
}

function normalizePath(path?: unknown) {
	if (typeof path !== "string" || path.trim() === "") {
		throw new HTTPException(400, { message: "path is required" });
	}

	return normalizeR2Key(path.trim());
}

function normalizeOptionalPrefix(prefix?: string) {
	if (!prefix) {
		return undefined;
	}

	return normalizeR2Key(prefix);
}

async function readJsonBody(c: AppContext) {
	try {
		const body = await c.req.json<Record<string, unknown>>();
		return body || {};
	} catch {
		throw new HTTPException(400, { message: "Expected JSON request body" });
	}
}

function parseJsonQuery(c: AppContext, name: string) {
	const value = c.req.query(name);
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value);
	} catch {
		throw new HTTPException(400, {
			message: `${name} must be a JSON string`,
		});
	}
}

function parseJsonValue(value: string | undefined, name: string) {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value);
	} catch {
		throw new HTTPException(400, {
			message: `${name} must be a JSON string`,
		});
	}
}

function normalizeMetadataRecord(value: unknown, name: string) {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new HTTPException(400, {
			message: `${name} must be a JSON object`,
		});
	}

	const metadata: Record<string, string> = {};
	for (const [key, metadataValue] of Object.entries(value)) {
		if (metadataValue === undefined || metadataValue === null) {
			continue;
		}

		metadata[key] =
			typeof metadataValue === "string"
				? metadataValue
				: JSON.stringify(metadataValue);
	}

	return metadata;
}

function getContentType(c: AppContext) {
	return c.req.header("Content-Type") || c.req.header("content-type") || "";
}

function isMultipartRequest(c: AppContext) {
	return getContentType(c).toLowerCase().includes("multipart/form-data");
}

function isUploadFormFile(value: unknown): value is UploadFormFile {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as File).name === "string" &&
		typeof (value as File).size === "number" &&
		typeof (value as File).stream === "function"
	);
}

function getFormString(formData: FormData, name: string) {
	const value = formData.get(name);
	return typeof value === "string" && value.trim() !== ""
		? value.trim()
		: undefined;
}

function normalizeUploadPrefix(prefix?: string) {
	if (!prefix) {
		return "";
	}

	const normalized = normalizeR2Key(prefix.trim());
	if (!normalized) {
		return "";
	}

	return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeUploadFilename(fileName: string) {
	const normalizedSeparators = fileName.replace(/\\/g, "/");
	const baseName = normalizedSeparators.split("/").filter(Boolean).pop();
	if (!baseName) {
		throw new HTTPException(400, { message: "Uploaded file name is required" });
	}

	return normalizeR2Key(baseName);
}

function success(c: AppContext, data: unknown) {
	return c.json({ success: true, data });
}

function getContentTypeFromPath(path: string) {
	const extension = path.split(".").pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		m3u: "text/plain; charset=utf-8",
		txt: "text/plain; charset=utf-8",
		json: "application/json; charset=utf-8",
		html: "text/html; charset=utf-8",
		css: "text/css",
		js: "application/javascript",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		webp: "image/webp",
		svg: "image/svg+xml",
		zip: "application/zip",
	};

	return mimeTypes[extension || ""] || "application/octet-stream";
}

async function createShare(
	c: AppContext,
	bucket: R2Bucket,
	bucketName: string,
	key: string,
	body: Record<string, unknown>,
) {
	const fileExists = await bucket.head(key);
	if (!fileExists) {
		throw new HTTPException(404, { message: `File not found: ${key}` });
	}

	let shareId = "";
	let foundUniqueShareId = false;
	for (let attempt = 0; attempt < 5; attempt++) {
		shareId = crypto.randomUUID().replace(/-/g, "").substring(0, 10);
		const existingShare = await bucket.head(
			`${SHARE_LINKS_PREFIX}${shareId}.json`,
		);
		if (!existingShare) {
			foundUniqueShareId = true;
			break;
		}
	}

	if (!foundUniqueShareId) {
		throw new HTTPException(500, {
			message: "Failed to generate unique share ID",
		});
	}

	let passwordHash: string | undefined;
	if (typeof body.password === "string" && body.password !== "") {
		const passwordData = new TextEncoder().encode(body.password);
		const hashBuffer = await crypto.subtle.digest("SHA-256", passwordData);
		passwordHash = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	const expiresIn =
		typeof body.expiresIn === "number" && body.expiresIn > 0
			? body.expiresIn
			: undefined;
	const maxDownloads =
		typeof body.maxDownloads === "number" && body.maxDownloads > 0
			? body.maxDownloads
			: undefined;
	const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
	const shareMetadata: ShareMetadata = {
		bucket: bucketName,
		key,
		expiresAt,
		passwordHash,
		maxDownloads,
		currentDownloads: 0,
		createdBy: c.get("authentication_username") || "anonymous",
		createdAt: Date.now(),
	};

	await bucket.put(
		`${SHARE_LINKS_PREFIX}${shareId}.json`,
		JSON.stringify(shareMetadata),
		{
			httpMetadata: { contentType: "application/json" },
			customMetadata: {
				targetBucket: bucketName,
				targetKey: key,
			},
		},
	);

	return {
		shareId,
		shareUrl: `${new URL(c.req.url).origin}/share/${shareId}`,
		expiresAt,
	};
}

async function listShares(c: AppContext, bucket: R2Bucket) {
	const sharesList = await bucket.list({ prefix: SHARE_LINKS_PREFIX });
	const shares = [];
	const now = Date.now();
	const origin = new URL(c.req.url).origin;

	for (const obj of sharesList.objects) {
		const shareId = obj.key.split("/").pop()?.replace(".json", "");
		if (!shareId) continue;

		const shareObject = await bucket.get(obj.key);
		if (!shareObject) continue;

		const metadata = JSON.parse(await shareObject.text()) as ShareMetadata;
		shares.push({
			shareId,
			shareUrl: `${origin}/share/${shareId}`,
			key: metadata.key,
			expiresAt: metadata.expiresAt,
			maxDownloads: metadata.maxDownloads,
			currentDownloads: metadata.currentDownloads || 0,
			createdBy: metadata.createdBy,
			createdAt: metadata.createdAt,
			isExpired: !!(metadata.expiresAt && now > metadata.expiresAt),
			hasPassword: !!metadata.passwordHash,
		});
	}

	return { shares };
}

async function handleMultipartUpload(c: AppContext) {
	const formData = await c.req.formData();
	const bucketField = getFormString(formData, "bucket");
	const { bucket } = resolveBucket(
		c,
		bucketField ? { bucket: bucketField } : {},
	);
	const files = formData.getAll("files").filter(isUploadFormFile);
	if (files.length === 0) {
		throw new HTTPException(400, {
			message: "At least one files field is required",
		});
	}

	const explicitPath = getFormString(formData, "path") || c.req.query("path");
	if (explicitPath && files.length > 1) {
		throw new HTTPException(400, {
			message: "path can only be used when uploading one file",
		});
	}

	const category = getFormString(formData, "category");
	const prefix =
		getFormString(formData, "prefix") || c.req.query("prefix") || category;
	const customMetadata = {
		...(normalizeMetadataRecord(
			parseJsonValue(
				getFormString(formData, "customMetadata"),
				"customMetadata",
			),
			"customMetadata",
		) || {}),
	};
	const source = getFormString(formData, "source");
	if (source) {
		customMetadata.source = source;
	}
	if (category) {
		customMetadata.category = category;
	}

	const httpMetadataOverride = parseJsonValue(
		getFormString(formData, "httpMetadata"),
		"httpMetadata",
	) as R2HTTPMetadata | undefined;
	const publicAccess = getFormString(formData, "publicAccess");
	if (
		publicAccess &&
		publicAccess !== "public" &&
		publicAccess !== "private" &&
		publicAccess !== "inherit"
	) {
		throw new HTTPException(400, {
			message: "publicAccess must be public, private, or inherit",
		});
	}

	const publicAccessRules = publicAccess
		? await loadPublicAccessRules(bucket)
		: undefined;
	if (publicAccessRules && !publicAccessRules.rules) {
		publicAccessRules.rules = {};
	}

	const basePrefix = normalizeUploadPrefix(prefix);
	const uploaded = [];

	for (const file of files) {
		const key = explicitPath
			? normalizePath(explicitPath)
			: normalizePath(`${basePrefix}${normalizeUploadFilename(file.name)}`);
		const contentType = file.type || getContentTypeFromPath(key);
		const object = await bucket.put(key, file.stream(), {
			customMetadata,
			httpMetadata: {
				...(httpMetadataOverride || {}),
				contentType: httpMetadataOverride?.contentType || contentType,
			},
		});

		uploaded.push({
			key,
			size: file.size,
			contentType,
			etag: object.etag,
			httpEtag: object.httpEtag,
		});

		if (publicAccessRules?.rules && publicAccess) {
			if (publicAccess === "inherit") {
				delete publicAccessRules.rules[key];
			} else {
				publicAccessRules.rules[key] =
					publicAccess === "public" ? "public" : "private";
			}
		}
	}

	if (publicAccessRules) {
		await savePublicAccessRules(bucket, publicAccessRules);
	}

	return success(c, {
		uploaded,
		failed: [],
	});
}

export function registerSimpleApiRoutes(app: App) {
	app.get("/api/config", async (c) => {
		const publicBaseUrl =
			c.get("config").publicBaseUrl || c.env.PUBLIC_BASE_URL;
		return success(c, {
			publicBaseUrl,
			defaultBucket: c.get("config").defaultBucket || c.env.DEFAULT_BUCKET,
		});
	});

	app.get("/api/list", async (c) => {
		const { bucket } = resolveBucket(c);
		const include = c.req.queries("include") as
			| ("httpMetadata" | "customMetadata")[]
			| undefined;

		const listed = await bucket.list({
			limit: c.req.query("limit")
				? Number.parseInt(c.req.query("limit") || "", 10)
				: undefined,
			prefix: normalizeOptionalPrefix(c.req.query("prefix")),
			cursor: c.req.query("cursor") || undefined,
			startAfter: c.req.query("startAfter") || undefined,
			delimiter: c.req.query("delimiter") || "",
			include,
		});

		return success(c, listed);
	});

	app.get("/api/file", async (c) => {
		const { bucket } = resolveBucket(c);
		const key = normalizePath(c.req.query("path"));
		const object = await bucket.get(key);
		if (!object) {
			throw new HTTPException(404, { message: `Object not found: ${key}` });
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("content-length", object.size.toString());
		headers.set(
			"content-type",
			object.httpMetadata?.contentType || getContentTypeFromPath(key),
		);

		return new Response(object.body, { headers });
	});

	app.post("/api/upload", async (c) => {
		if (isMultipartRequest(c)) {
			return handleMultipartUpload(c);
		}

		const { bucket } = resolveBucket(c);
		const key = normalizePath(c.req.query("path"));
		const customMetadata = normalizeMetadataRecord(
			parseJsonQuery(c, "customMetadata"),
			"customMetadata",
		);
		const httpMetadata =
			parseJsonQuery(c, "httpMetadata") ||
			(getContentType(c) ? { contentType: getContentType(c) } : undefined);

		const object = await bucket.put(key, c.req.raw.body, {
			customMetadata,
			httpMetadata,
		});

		return success(c, object);
	});

	app.post("/api/folder", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const key = normalizePath(body.path);
		const folderKey = key.endsWith("/") ? key : `${key}/`;
		const object = await bucket.put(folderKey, "");
		return success(c, object);
	});

	app.post("/api/delete", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const key = normalizePath(body.path);
		await bucket.delete(key);
		return success(c, { deleted: true, key });
	});

	app.post("/api/move", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const from = normalizePath(body.from);
		const to = normalizePath(body.to);
		const object = await bucket.get(from);
		if (!object) {
			throw new HTTPException(404, {
				message: `Source object not found: ${from}`,
			});
		}

		const moved = await bucket.put(to, object.body, {
			customMetadata: object.customMetadata,
			httpMetadata: object.httpMetadata,
		});
		await bucket.delete(from);

		return success(c, moved);
	});

	app.post("/api/copy", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const from = normalizePath(body.from);
		const to = normalizePath(body.to);
		const object = await bucket.get(from);
		if (!object) {
			throw new HTTPException(404, {
				message: `Source object not found: ${from}`,
			});
		}

		const copied = await bucket.put(to, object.body, {
			customMetadata: object.customMetadata,
			httpMetadata: object.httpMetadata,
		});

		return success(c, copied);
	});

	app.post("/api/metadata", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const key = normalizePath(body.path);
		const object = await bucket.get(key);
		if (!object) {
			throw new HTTPException(404, { message: "Object not found" });
		}

		const updated = await bucket.put(key, object.body, {
			customMetadata:
				typeof body.customMetadata === "object"
					? (body.customMetadata as Record<string, string>)
					: {},
			httpMetadata:
				typeof body.httpMetadata === "object"
					? (body.httpMetadata as R2HTTPMetadata)
					: {},
		});

		return success(c, updated);
	});

	app.get("/api/public-access", async (c) => {
		const { bucket } = resolveBucket(c);
		const key = normalizePath(c.req.query("path"));
		const rules = await loadPublicAccessRules(bucket);
		return success(c, getEffectivePublicAccess(rules, key));
	});

	app.post("/api/public-access", async (c) => {
		const body = await readJsonBody(c);
		const { bucket } = resolveBucket(c, body);
		const key = normalizePath(body.path);
		const access = body.access;
		if (access !== "public" && access !== "private" && access !== "inherit") {
			throw new HTTPException(400, {
				message: "access must be public, private, or inherit",
			});
		}

		const rules = await loadPublicAccessRules(bucket);
		if (!rules.rules) {
			rules.rules = {};
		}

		if (access === "inherit") {
			delete rules.rules[key];
		} else {
			rules.rules[key] = access;
		}

		await savePublicAccessRules(bucket, rules);
		return success(c, getEffectivePublicAccess(rules, key));
	});

	app.post("/api/share", async (c) => {
		const body = await readJsonBody(c);
		const { bucketName, bucket } = resolveBucket(c, body);
		const key = normalizePath(body.path);
		return success(c, await createShare(c, bucket, bucketName, key, body));
	});

	app.get("/api/shares", async (c) => {
		const { bucket } = resolveBucket(c);
		return success(c, await listShares(c, bucket));
	});

	app.delete("/api/share", async (c) => {
		const { bucket } = resolveBucket(c);
		const shareId = c.req.query("id");
		if (!shareId) {
			throw new HTTPException(400, { message: "id is required" });
		}

		const shareKey = `${SHARE_LINKS_PREFIX}${shareId}.json`;
		const shareExists = await bucket.head(shareKey);
		if (!shareExists) {
			throw new HTTPException(404, {
				message: `Share link not found: ${shareId}`,
			});
		}

		await bucket.delete(shareKey);
		return success(c, { deleted: true, shareId });
	});
}
