import { cloudflareAccess } from "@hono/cloudflare-access";
import {
	type OpenAPIObjectConfigV31,
	extendZodWithOpenApi,
	fromHono,
} from "chanfana";
import { type ExecutionContext, Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

function extractToken(headerValue?: string | null) {
	if (!headerValue) {
		return undefined;
	}

	if (headerValue.startsWith("Bearer ")) {
		return headerValue.slice(7).trim();
	}

	return headerValue.trim();
}

function isWriteMethod(method: string) {
	return ["PUT", "POST", "PATCH", "DELETE"].includes(method);
}

function getConfiguredApiToken(c: AppContext) {
	return (
		c.get("config").apiToken ||
		c.get("config").adminToken ||
		c.env.API_TOKEN ||
		c.env.ADMIN_TOKEN ||
		undefined
	);
}

function requestHasApiToken(c: AppContext, apiToken?: string) {
	if (!apiToken) {
		return false;
	}

	const requestToken = extractToken(
		c.req.header("Authorization") ||
			c.req.header("x-api-key") ||
			(["GET", "HEAD"].includes(c.req.method) ? c.req.query("token") : null),
	);

	return requestToken === apiToken;
}

function getBasicAuthCredentials(headerValue?: string | null) {
	if (!headerValue?.startsWith("Basic ")) {
		return undefined;
	}

	try {
		const decoded = atob(headerValue.slice(6).trim());
		const separatorIndex = decoded.indexOf(":");
		if (separatorIndex === -1) {
			return undefined;
		}

		return {
			username: decoded.slice(0, separatorIndex),
			password: decoded.slice(separatorIndex + 1),
		};
	} catch {
		return undefined;
	}
}

function requestHasBasicAuth(c: AppContext) {
	const credentials = getBasicAuthCredentials(c.req.header("Authorization"));
	if (!credentials) {
		return false;
	}

	const users = (
		Array.isArray(c.get("config").basicAuth)
			? c.get("config").basicAuth
			: [c.get("config").basicAuth]
	) as BasicAuthType[];

	for (const user of users) {
		if (
			user.username === credentials.username &&
			user.password === credentials.password
		) {
			c.set("authentication_type", "basic-auth");
			c.set("authentication_username", credentials.username);
			return true;
		}
	}

	return false;
}

function getContentTypeFromPath(pathname: string) {
	const extension = pathname.split(".").pop()?.toLowerCase();

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
import { readOnlyMiddleware } from "./foundation/middlewares/readonly";
import { settings } from "./foundation/settings";
import { CopyObject } from "./modules/buckets/copyObject";
import { CreateFolder } from "./modules/buckets/createFolder";
import { CreateShareLink } from "./modules/buckets/createShareLink";
import { DeleteObject } from "./modules/buckets/deleteObject";
import { DeleteShareLink } from "./modules/buckets/deleteShareLink";
import { GetObject } from "./modules/buckets/getObject";
import { GetPublicAccess } from "./modules/buckets/getPublicAccess";
import { GetShareLink } from "./modules/buckets/getShareLink";
import { HeadObject } from "./modules/buckets/headObject";
import { ListObjects } from "./modules/buckets/listObjects";
import { ListShares } from "./modules/buckets/listShares";
import { MoveObject } from "./modules/buckets/moveObject";
import { CompleteUpload } from "./modules/buckets/multipart/completeUpload";
import { CreateUpload } from "./modules/buckets/multipart/createUpload";
import { PartUpload } from "./modules/buckets/multipart/partUpload";
import { isPublicObjectAccessAllowed } from "./modules/buckets/publicAccess";
import { PutMetadata } from "./modules/buckets/putMetadata";
import { PutObject } from "./modules/buckets/putObject";
import { SetPublicAccess } from "./modules/buckets/setPublicAccess";
import { dashboardIndex, dashboardRedirect } from "./modules/dashboard";
import { receiveEmail } from "./modules/emails/receiveEmail";
import { SendEmail } from "./modules/emails/sendEmail";
import { GetInfo } from "./modules/server/getInfo";
import { registerSimpleApiRoutes } from "./modules/simpleApi";
import type {
	AppContext,
	AppEnv,
	AppVariables,
	BasicAuthType,
	R2ExplorerConfig,
} from "./types";

export function R2Explorer(config?: R2ExplorerConfig) {
	extendZodWithOpenApi(z);
	config = config || {};
	if (config.readonly !== false) config.readonly = true;

	const openapiSchema: OpenAPIObjectConfigV31 = {
		openapi: "3.1.0",
		info: {
			title: "R2 Explorer API",
			version: settings.version,
		},
	};

	if (config.basicAuth) {
		openapiSchema["security"] = [
			{
				basicAuth: [],
			},
		];
	}

	const app = new Hono<{ Bindings: AppEnv; Variables: AppVariables }>();
	app.use("*", async (c, next) => {
		c.set("config", config);
		await next();
	});

	const openapi = fromHono(app, {
		schema: openapiSchema,
		raiseUnknownParameters: true,
		generateOperationIds: false,
	});

	if (config.cors === true) {
		app.use("/api/*", cors());
	}

	if (config.readonly === true) {
		app.use("/api/*", readOnlyMiddleware);
	}

	if (config.cfAccessTeamName) {
		app.use("/api/*", cloudflareAccess(config.cfAccessTeamName));
		app.use("/api/*", async (c, next) => {
			c.set("authentication_type", "cloudflare-access");
			c.set("authentication_username", c.get("accessPayload").email);
			await next();
		});
	}

	if (config.basicAuth) {
		openapi.registry.registerComponent("securitySchemes", "basicAuth", {
			type: "http",
			scheme: "basic",
		});

		app.use("/api/*", async (c, next) => {
			if (c.req.method === "OPTIONS") {
				await next();
				return;
			}

			if (requestHasApiToken(c, getConfiguredApiToken(c))) {
				c.set("authentication_type", "api-token");
				c.set("authentication_username", "api-token");
				await next();
				return;
			}

			if (requestHasBasicAuth(c)) {
				await next();
				return;
			}

			return c.text("Authentication error: Basic Auth required", 401);
		});
	} else {
		app.use("/api/*", async (c, next) => {
			if (c.req.method === "OPTIONS") {
				await next();
				return;
			}

			const apiToken = getConfiguredApiToken(c);
			if (!apiToken) {
				await next();
				return;
			}

			if (!requestHasApiToken(c, apiToken)) {
				return c.text("Authentication required", 401);
			}

			c.set("authentication_type", "api-token");
			c.set("authentication_username", "api-token");
			await next();
		});
	}

	app.options("*", (c) => {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods":
					"GET, POST, PUT, PATCH, DELETE, OPTIONS",
				"Access-Control-Allow-Headers":
					"Authorization, x-api-key, Content-Type",
			},
		});
	});

	openapi.get("/api/server/config", GetInfo);

	registerSimpleApiRoutes(app);

	openapi.get("/api/buckets/:bucket", ListObjects);
	openapi.post("/api/buckets/:bucket/move", MoveObject);
	openapi.post("/api/buckets/:bucket/copy", CopyObject);
	openapi.post("/api/buckets/:bucket/folder", CreateFolder);
	openapi.post("/api/buckets/:bucket/upload", PutObject);
	openapi.post("/api/buckets/:bucket/multipart/create", CreateUpload);
	openapi.post("/api/buckets/:bucket/multipart/upload", PartUpload);
	openapi.post("/api/buckets/:bucket/multipart/complete", CompleteUpload);
	openapi.post("/api/buckets/:bucket/delete", DeleteObject);
	openapi.on("head", "/api/buckets/:bucket/:key", HeadObject);
	openapi.get("/api/buckets/:bucket/:key/head", HeadObject); // There are some issues with calling the head method

	// Share link routes
	openapi.post("/api/buckets/:bucket/:key/share", CreateShareLink);
	openapi.get("/api/buckets/:bucket/shares", ListShares);
	openapi.delete("/api/buckets/:bucket/share/:shareId", DeleteShareLink);
	openapi.get("/api/buckets/:bucket/:key/public-access", GetPublicAccess);
	openapi.post("/api/buckets/:bucket/:key/public-access", SetPublicAccess);

	// These object routes should be defined last
	openapi.get("/api/buckets/:bucket/:key", GetObject);
	openapi.post("/api/buckets/:bucket/:key", PutMetadata);

	openapi.post("/api/emails/send", SendEmail);

	// Public share access (no authentication required)
	openapi.get("/share/:shareId", GetShareLink);

	app.get("*", async (c, next) => {
		const url = new URL(c.req.url);
		const pathname = url.pathname;
		const method = c.req.method;

		if (method !== "GET" && method !== "HEAD") {
			await next();
			return;
		}

		if (
			pathname === "/" ||
			pathname.startsWith("/api/") ||
			pathname.startsWith("/admin") ||
			pathname.startsWith("/auth/") ||
			pathname.startsWith("/assets/") ||
			pathname.startsWith("/icons/") ||
			pathname === "/favicon.ico" ||
			pathname === "/logo-white.svg"
		) {
			await next();
			return;
		}

		const bucket = c.env.R2 as R2Bucket | undefined;
		if (!bucket) {
			await next();
			return;
		}

		const key = decodeURIComponent(pathname.slice(1));
		if (!(await isPublicObjectAccessAllowed(bucket, key))) {
			await next();
			return;
		}

		const object = await bucket.get(key);
		if (object === null) {
			await next();
			return;
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("access-control-allow-origin", "*");
		headers.set("cache-control", "public, max-age=300");
		headers.set("etag", object.httpEtag);
		headers.set("content-length", object.size.toString());
		headers.set("content-disposition", "inline");
		headers.set(
			"content-type",
			object.httpMetadata?.contentType || getContentTypeFromPath(key),
		);

		return new Response(method === "HEAD" ? null : object.body, {
			status: 200,
			headers,
		});
	});

	openapi.get("/admin", dashboardIndex);
	openapi.get("/admin/*", dashboardRedirect);
	openapi.get("/", dashboardIndex);
	openapi.get("*", dashboardRedirect);

	app.all("*", () =>
		Response.json({ msg: "404, not found!" }, { status: 404 }),
	);

	return {
		// TODO: improve event type
		async email(
			event: { raw: unknown; rawSize: unknown },
			env: AppEnv,
			context: ExecutionContext,
		) {
			await receiveEmail(event, env, context, config);
		},
		async fetch(request: Request, env: unknown, context: ExecutionContext) {
			return app.fetch(request, env as AppEnv, context);
		},
	};
}
