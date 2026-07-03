import { OpenAPIRoute } from "chanfana";
import { settings } from "../../foundation/settings";
import type { AppContext } from "../../types";

function isR2BucketBinding(value: unknown): value is R2Bucket {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as R2Bucket).get === "function" &&
		typeof (value as R2Bucket).put === "function" &&
		typeof (value as R2Bucket).list === "function"
	);
}

export class GetInfo extends OpenAPIRoute {
	schema = {
		operationId: "get-server-info",
		tags: ["Server"],
		summary: "Get server info",
	};

	async handle(c: AppContext) {
		const {
			basicAuth,
			buckets: bucketsConfig,
			adminToken,
			apiToken,
			...config
		} = c.get("config");
		const publicBaseUrl = config.publicBaseUrl || c.env.PUBLIC_BASE_URL;
		const serverConfig = {
			...config,
			...(publicBaseUrl ? { publicBaseUrl } : {}),
		};

		const buckets = [];

		for (const [key, value] of Object.entries(c.env)) {
			if (key === "ASSETS") continue;
			if (isR2BucketBinding(value)) {
				buckets.push({
					name: key,
					publicUrl: bucketsConfig?.[key]?.publicUrl || publicBaseUrl || null,
				});
			}
		}

		return {
			version: settings.version,
			config: serverConfig,
			auth: c.get("authentication_type")
				? {
						type: c.get("authentication_type"),
						username: c.get("authentication_username"),
					}
				: undefined,
			buckets: buckets,
		};
	}
}
