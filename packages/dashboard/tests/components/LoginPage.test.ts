import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import LoginPage from "pages/auth/LoginPage.vue";
import { useAuthStore } from "stores/auth-store";
import { useMainStore } from "stores/main-store";
import { api } from "boot/axios";
import { mountWithContext, mockServerConfig } from "../helpers";

describe("LoginPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders login form in Chinese by default", async () => {
		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		expect(wrapper.text()).toContain("登录");
		expect(wrapper.text()).toContain("用户名");
	});

	it("renders login form in English after locale switch", async () => {
		const mainStore = useMainStore();
		mainStore.setLocale("en-US");

		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		expect(wrapper.text()).toContain("Sign in");
		expect(wrapper.text()).toContain("Username");
	});

	it("has remember me toggle defaulting to true", async () => {
		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		expect(wrapper.vm.form.remind).toBe(true);
	});

	it("calls authStore.LogIn on form submit", async () => {
		// Mock the API to return a valid config (LogIn calls loadServerConfigs internally)
		const serverConfig = mockServerConfig();
		vi.mocked(api.get).mockResolvedValue({ data: serverConfig });

		Object.defineProperty(window, "location", {
			value: {
				href: "http://localhost/auth/login",
				origin: "http://localhost",
			},
			writable: true,
		});

		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		wrapper.vm.form.username = "admin";
		wrapper.vm.form.password = "secret";

		await wrapper.vm.onSubmit();
		await flushPromises();

		// Verify the auth header was set (LoginPage uses the real authStore)
		const expectedToken = btoa("admin:secret");
		expect(api.defaults.headers.common.Authorization).toBe(
			`Basic ${expectedToken}`,
		);
	});

	it("shows error message on login failure", async () => {
		vi.mocked(api.get).mockRejectedValue({
			response: { status: 401, data: "Unauthorized" },
		});

		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		wrapper.vm.form.username = "admin";
		wrapper.vm.form.password = "wrong";

		await expect(wrapper.vm.onSubmit()).rejects.toThrow();
		await flushPromises();

		expect(wrapper.vm.showError).toBe("Invalid username or password");
	});

	it("sets loading state during submit", async () => {
		let resolveApi: (value: any) => void;
		const apiPromise = new Promise((r) => {
			resolveApi = r;
		});
		vi.mocked(api.get).mockReturnValue(apiPromise as any);

		const wrapper = await mountWithContext(LoginPage, {
			initialRoute: "/auth/login",
		});

		expect(wrapper.vm.loading).toBe(false);

		const submitPromise = wrapper.vm.onSubmit();
		expect(wrapper.vm.loading).toBe(true);

		Object.defineProperty(window, "location", {
			value: {
				href: "http://localhost/auth/login",
				origin: "http://localhost",
			},
			writable: true,
		});

		resolveApi!({ data: mockServerConfig() });
		await submitPromise;
		expect(wrapper.vm.loading).toBe(false);
	});
});
