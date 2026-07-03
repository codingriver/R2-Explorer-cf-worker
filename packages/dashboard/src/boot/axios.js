import axios from "axios";
import { boot } from "quasar/wrappers";

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
let url = window.location.origin;
if (process.env.NODE_ENV === "development") {
	url = process.env.VUE_APP_SERVER_URL || "http://localhost:8787";
}
const api = axios.create({ baseURL: `${url}/api` });

const SESSION_KEY = "r2_explorer_session_token";

export default boot(({ app, router }) => {
	// for use inside Vue files (Options API) through this.$axios and this.$api

	app.config.globalProperties.$axios = axios;
	// ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
	//       so you won't necessarily have to import axios in each vue file

	app.config.globalProperties.$api = api;
	// ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
	//       so you can easily perform requests against your app's API

	api.interceptors.response.use(
		(response) => response,
		async (error) => {
			const isBasicAuthRequired =
				error?.response?.status === 401 &&
				error?.response?.data === "Authentication error: Basic Auth required";

			if (
				isBasicAuthRequired &&
				router.currentRoute.value.path !== "/auth/login"
			) {
				delete api.defaults.headers.common.Authorization;
				localStorage.removeItem(SESSION_KEY);
				sessionStorage.removeItem(SESSION_KEY);

				await router.push({
					name: "login",
					query: { next: router.currentRoute.value.fullPath },
				});
			}

			return Promise.reject(error);
		},
	);
});

export { api };
