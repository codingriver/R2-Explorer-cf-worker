import FileContextMenu from "pages/files/FileContextMenu.vue";
import { useMainStore } from "stores/main-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWithContext } from "../helpers";

const fileProp = {
	row: {
		key: "photos/image.jpg",
		name: "image.jpg",
		nameHash: "aW1hZ2UuanBn",
		type: "file",
		icon: "article",
		color: "grey",
	},
};

const folderProp = {
	row: {
		key: "photos/",
		name: "photos/",
		type: "folder",
		icon: "folder",
		color: "orange",
	},
};

describe("FileContextMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows file-specific items for a file", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const text = wrapper.text();
		expect(text).toContain("打开");
		expect(text).toContain("下载");
		expect(text).toContain("重命名");
		expect(text).toContain("更新元数据");
		expect(text).toContain("删除");
		expect(text).toContain("创建分享链接");
		expect(text).toContain("设为公开");
		expect(text).toContain("设为私有");
		expect(text).toContain("继承上级访问规则");
	});

	it("hides file-only items for a folder", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: folderProp },
			initialRoute: "/my-bucket/files",
		});

		const text = wrapper.text();
		expect(text).toContain("打开");
		expect(text).toContain("删除");
		expect(text).toContain("设为公开");
		expect(text).toContain("设为私有");
		expect(text).toContain("继承上级访问规则");
		expect(text).not.toContain("下载");
		expect(text).not.toContain("重命名");
		expect(text).not.toContain("更新元数据");
		expect(text).not.toContain("创建分享链接");
	});

	it("shows Copy Public URL when bucket has publicUrl", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const store = useMainStore();
		store.buckets = [
			{ name: "my-bucket", publicUrl: "https://cdn.example.com" },
		] as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("复制公开 URL");
	});

	it("hides Copy Public URL when no publicUrl", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const store = useMainStore();
		store.buckets = [{ name: "my-bucket" }] as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).not.toContain("复制公开 URL");
	});

	it("emits openObject when Open is clicked", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		// Find the QItem stub containing "打开" and click it
		const items = wrapper.findAllComponents({ name: "QItem" });
		const openItem = items.find((i) => i.text().includes("打开"));
		expect(openItem).toBeTruthy();
		await openItem?.trigger("click");

		expect(wrapper.emitted("openObject")).toBeTruthy();
	});

	it("emits deleteObject when Delete is clicked", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const items = wrapper.findAllComponents({ name: "QItem" });
		const deleteItem = items.find((i) => i.text().includes("删除"));
		expect(deleteItem).toBeTruthy();
		await deleteItem?.trigger("click");

		expect(wrapper.emitted("deleteObject")).toBeTruthy();
	});

	it("computes selectedBucket from route", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		expect(wrapper.vm.selectedBucket).toBe("my-bucket");
	});

	it("can render English labels after locale switch", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});
		const store = useMainStore();
		store.setLocale("en-US");
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("Open");
		expect(wrapper.text()).toContain("Create Share Link");
	});
});
