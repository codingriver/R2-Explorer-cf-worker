import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
	decodeR2Key,
	getBucketOrThrow,
	getEffectivePublicAccess,
	loadPublicAccessRules,
} from "./publicAccess";

export class GetPublicAccess extends OpenAPIRoute {
	schema = {
		operationId: "get-bucket-public-access",
		tags: ["Buckets"],
		summary: "Get public access status",
		request: {
			params: z.object({
				bucket: z.string(),
				key: z.string().describe("base64 encoded file or folder key"),
			}),
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const bucket = getBucketOrThrow(c.env, data.params.bucket);
		const key = decodeR2Key(data.params.key);
		const rules = await loadPublicAccessRules(bucket);

		return c.json(getEffectivePublicAccess(rules, key));
	}
}
