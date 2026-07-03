import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
	type PublicAccessUpdate,
	decodeR2Key,
	getBucketOrThrow,
	getEffectivePublicAccess,
	loadPublicAccessRules,
	normalizeR2Key,
	savePublicAccessRules,
} from "./publicAccess";

export class SetPublicAccess extends OpenAPIRoute {
	schema = {
		operationId: "post-bucket-public-access",
		tags: ["Buckets"],
		summary: "Set public access rule",
		request: {
			params: z.object({
				bucket: z.string(),
				key: z.string().describe("base64 encoded file or folder key"),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							access: z.enum(["public", "private", "inherit"]),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const access = data.body.access as PublicAccessUpdate;
		const bucket = getBucketOrThrow(c.env, data.params.bucket);
		const key = normalizeR2Key(decodeR2Key(data.params.key));
		const publicAccessRules = await loadPublicAccessRules(bucket);

		if (!publicAccessRules.rules) {
			publicAccessRules.rules = {};
		}

		if (access === "inherit") {
			delete publicAccessRules.rules[key];
		} else {
			publicAccessRules.rules[key] = access;
		}

		await savePublicAccessRules(bucket, publicAccessRules);

		return c.json(getEffectivePublicAccess(publicAccessRules, key));
	}
}
