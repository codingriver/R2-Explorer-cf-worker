import { R2Explorer } from "../src";

const DEFAULT_API_TOKEN = "codingriver";
const DEFAULT_BASIC_AUTH_USERNAME = "admin";
const DEFAULT_BASIC_AUTH_PASSWORD = "codingriver";

function createConfig(env: Record<string, unknown>) {
	const basicAuthUsername =
		typeof env.BASIC_AUTH_USERNAME === "string"
			? env.BASIC_AUTH_USERNAME
			: DEFAULT_BASIC_AUTH_USERNAME;
	const basicAuthPassword =
		typeof env.BASIC_AUTH_PASSWORD === "string"
			? env.BASIC_AUTH_PASSWORD
			: DEFAULT_BASIC_AUTH_PASSWORD;
	const apiToken =
		typeof env.API_TOKEN === "string"
			? env.API_TOKEN
			: typeof env.ADMIN_TOKEN === "string"
				? env.ADMIN_TOKEN
				: DEFAULT_API_TOKEN;

	return {
		readonly: false,
		cors: true,
		showHiddenFiles: true,
		publicBaseUrl:
			typeof env.PUBLIC_BASE_URL === "string" ? env.PUBLIC_BASE_URL : undefined,
		apiToken,
		basicAuth: {
			username: basicAuthUsername,
			password: basicAuthPassword,
		},
	};
}

export default {
	async email(event, env, context) {
		await R2Explorer(createConfig(env)).email(event, env, context);
	},
	async fetch(request, env, context) {
		return R2Explorer(createConfig(env)).fetch(request, env, context);
	},
};
