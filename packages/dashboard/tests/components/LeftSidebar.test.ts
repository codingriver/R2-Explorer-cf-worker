import { describe, it, expect, vi, beforeEach } from "vitest";
import LeftSidebar from "components/main/LeftSidebar.vue";
import { useMainStore } from "stores/main-store";
import { mountWithContext } from "../helpers";

describe("LeftSidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
		} as Response);
	});

	it("shows 'Read only' label when apiReadonly is true", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.apiReadonly = true;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("只读");
	});

	it("shows 'New' label when not readonly", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.apiReadonly = false;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("新建");
	});

	it("hides 'New' when readonly", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.apiReadonly = true;
		await wrapper.vm.$nextTick();

		const btns = wrapper.findAllComponents({ name: "QBtn" });
		const newBtn = btns.find((b) => b.props("label") === "新建");
		expect(newBtn).toBeUndefined();
	});

	it("shows Files button", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});

		expect(wrapper.text()).toContain("文件");
	});

	it("shows Email nav when emailRouting is enabled", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.config = { emailRouting: true } as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("邮件");
	});

	it("hides Email nav when emailRouting is false", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.config = { emailRouting: false } as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).not.toContain("邮件");
	});

	it("shows Info button", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});

		expect(wrapper.text()).toContain("信息");
	});

	it("can switch labels to English", async () => {
		const wrapper = await mountWithContext(LeftSidebar, {
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.setLocale("en-US");
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("Files");
		expect(wrapper.text()).toContain("Language");
	});

	describe("isUpdateAvailable", () => {
		it("returns true when latest is newer major", async () => {
			const w = await mountWithContext(LeftSidebar, {
				initialRoute: "/my-bucket/files",
			});
			expect(w.vm.isUpdateAvailable("1.0.0", "2.0.0")).toBe(true);
		});

		it("returns true when latest is newer minor", async () => {
			const w = await mountWithContext(LeftSidebar, {
				initialRoute: "/my-bucket/files",
			});
			expect(w.vm.isUpdateAvailable("1.0.0", "1.1.0")).toBe(true);
		});

		it("returns true when latest is newer patch", async () => {
			const w = await mountWithContext(LeftSidebar, {
				initialRoute: "/my-bucket/files",
			});
			expect(w.vm.isUpdateAvailable("1.0.0", "1.0.1")).toBe(true);
		});

		it("returns false when versions are equal", async () => {
			const w = await mountWithContext(LeftSidebar, {
				initialRoute: "/my-bucket/files",
			});
			expect(w.vm.isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
		});

		it("returns false when current is newer", async () => {
			const w = await mountWithContext(LeftSidebar, {
				initialRoute: "/my-bucket/files",
			});
			expect(w.vm.isUpdateAvailable("2.0.0", "1.0.0")).toBe(false);
		});
	});
});
