import { HTTPException } from "hono/http-exception";

export const PUBLIC_ACCESS_RULES_KEY =
	".r2-explorer/permissions/public-rules.json";

export type PublicAccessRule = "public" | "private";
export type PublicAccessUpdate = PublicAccessRule | "inherit";

export type PublicAccessRules = {
	defaultPublic?: boolean;
	rules?: Record<string, PublicAccessRule>;
};

export type PublicAccessStatus = {
	key: string;
	access: PublicAccessUpdate;
	effectiveAccess: PublicAccessRule;
	inheritedFrom: string | null;
};

export function decodeR2Key(encodedKey: string) {
	return decodeURIComponent(escape(atob(encodedKey)));
}

export function normalizeR2Key(key: string) {
	return key.replace(/^\/+/, "");
}

export async function loadPublicAccessRules(bucket: R2Bucket) {
	const object = await bucket.get(PUBLIC_ACCESS_RULES_KEY);
	if (!object) {
		return { defaultPublic: false, rules: {} } satisfies PublicAccessRules;
	}

	try {
		const parsed = JSON.parse(await object.text()) as PublicAccessRules;
		return {
			defaultPublic: parsed.defaultPublic === true,
			rules: parsed.rules || {},
		} satisfies PublicAccessRules;
	} catch {
		return { defaultPublic: false, rules: {} } satisfies PublicAccessRules;
	}
}

export async function savePublicAccessRules(
	bucket: R2Bucket,
	rules: PublicAccessRules,
) {
	await bucket.put(PUBLIC_ACCESS_RULES_KEY, JSON.stringify(rules, null, 2), {
		httpMetadata: { contentType: "application/json; charset=utf-8" },
	});
}

export function getEffectivePublicAccess(
	rulesConfig: PublicAccessRules,
	key: string,
) {
	const normalizedKey = normalizeR2Key(key);
	const rules = rulesConfig.rules || {};
	let matchedKey: string | null = null;
	let matchedAccess: PublicAccessRule | undefined;

	for (const [ruleKey, access] of Object.entries(rules)) {
		const normalizedRuleKey = normalizeR2Key(ruleKey);
		const isExactMatch = normalizedKey === normalizedRuleKey;
		const isFolderMatch =
			normalizedRuleKey.endsWith("/") &&
			normalizedKey.startsWith(normalizedRuleKey);

		if (
			(isExactMatch || isFolderMatch) &&
			(matchedKey === null || normalizedRuleKey.length > matchedKey.length)
		) {
			matchedKey = normalizedRuleKey;
			matchedAccess = access;
		}
	}

	const effectiveAccess =
		matchedAccess || (rulesConfig.defaultPublic ? "public" : "private");

	return {
		key: normalizedKey,
		access: rules[normalizedKey] || "inherit",
		effectiveAccess,
		inheritedFrom: matchedKey,
	} satisfies PublicAccessStatus;
}

export async function isPublicObjectAccessAllowed(
	bucket: R2Bucket,
	key: string,
) {
	const normalizedKey = normalizeR2Key(key);
	if (normalizedKey.startsWith(".r2-explorer/")) {
		return false;
	}

	const rules = await loadPublicAccessRules(bucket);
	return (
		getEffectivePublicAccess(rules, normalizedKey).effectiveAccess === "public"
	);
}

export function getBucketOrThrow(
	env: Record<string, unknown>,
	bucketName: string,
) {
	const bucket = env[bucketName] as R2Bucket | undefined;
	if (!bucket) {
		throw new HTTPException(500, {
			message: `Bucket binding not found: ${bucketName}`,
		});
	}

	return bucket;
}
