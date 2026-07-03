import type { AppContext } from "../types";

export function dashboardIndex(c: AppContext) {
	const url = new URL(c.req.url);
	const hasBasicAuth = Boolean(c.get("config").basicAuth);
	const hasAuthorization = Boolean(c.req.header("Authorization"));

	if (hasBasicAuth && !hasAuthorization) {
		return c.redirect("/auth/login?next=/admin");
	}

	if (url.pathname === "/") {
		return c.redirect("/admin");
	}

	if (c.env.ASSETS === undefined) {
		return c.text(
			"ASSETS binding is not defined, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
			500,
		);
	}

	if (typeof (c.env.ASSETS as { fetch?: unknown }).fetch !== "function") {
		return c.text(
			"ASSETS binding is not pointing to a valid dashboard, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
			500,
		);
	}

	return c.env.ASSETS.fetch(
		new Request(`${url.origin}${url.pathname}${url.search}`),
	);
}

export async function dashboardRedirect(c: AppContext, next) {
	if (c.env.ASSETS === undefined) {
		return c.text(
			"ASSETS binding is not defined, learn more here: https://r2explorer.com/guides/migrating-to-1.1/",
			500,
		);
	}

	const url = new URL(c.req.url);
	const staticAssetPath =
		url.pathname.startsWith("/assets/") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname === "/favicon.ico" ||
		url.pathname === "/logo-white.svg";

	if (staticAssetPath || !url.pathname.includes(".")) {
		return c.env.ASSETS.fetch(
			new Request(`${url.origin}${url.pathname}${url.search}`),
		);
	}

	await next();
}
