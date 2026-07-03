import { flushPromises } from "@vue/test-utils";
import FilesFolderPage from "pages/files/FilesFolderPage.vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountWithContext } from "../helpers";

// Mock the apiHandler
vi.mock("src/appUtils", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		apiHandler: {
			...actual.apiHandler,
			fetchFilePage: vi.fn().mockResolvedValue({
				files: [],
				truncated: false,
				cursor: null,
			}),
			headFile: vi.fn(),
			listObjects: vi.fn(),
			getPublicAccess: vi.fn().mockResolvedValue({
				data: {
					access: "inherit",
					effectiveAccess: "private",
					inheritedFrom: null,
				},
			}),
			setPublicAccess: vi.fn().mockResolvedValue({
				data: {
					access: "public",
					effectiveAccess: "public",
					inheritedFrom: "document.pdf",
				},
			}),
		},
	};
});

import { apiHandler } from "src/appUtils";

// QTable stub with sort method that FilesFolderPage.mounted() calls
const QTableStub = {
	name: "QTable",
	props: ["rows", "columns", "loading"],
	template:
		'<div class="q-table"><slot name="body" /><slot name="no-data" /><slot name="loading" /><slot /></div>',
	methods: {
		sort: vi.fn(),
	},
};

async function mountPage(route = "/my-bucket/files") {
	return mountWithContext(FilesFolderPage, {
		initialRoute: route,
		global: {
			stubs: {
				QTable: QTableStub,
				// Stub child components that have complex templates
				FilePreview: {
					name: "FilePreview",
					template: "<div />",
					methods: { openFile: vi.fn() },
				},
				FileContextMenu: true,
				FileOptions: true,
				DragAndDrop: { name: "DragAndDrop", template: "<div><slot /></div>" },
				ShareFile: {
					name: "ShareFile",
					template: "<div />",
					methods: { openManageShares: vi.fn(), openCreateShare: vi.fn() },
				},
			},
		},
	});
}

describe("FilesFolderPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files: [],
			truncated: false,
			cursor: null,
		});
		vi.mocked(apiHandler.getPublicAccess).mockResolvedValue({
			data: {
				access: "inherit",
				effectiveAccess: "private",
				inheritedFrom: null,
			},
		});
	});

	it("renders breadcrumbs showing bucket name at root", async () => {
		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.breadcrumbs).toEqual([{ name: "my-bucket", path: "/" }]);
	});

	it("renders empty state text when no files", async () => {
		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.rows).toEqual([]);
	});

	it("populates rows when files exist", async () => {
		const files = [
			{
				name: "document.pdf",
				key: "document.pdf",
				hash: "hash1",
				nameHash: "nameHash1",
				lastModified: "2 hours",
				timestamp: Date.now(),
				size: "1 KB",
				sizeRaw: 1024,
				type: "file",
				icon: "article",
				color: "grey",
			},
			{
				name: "photos/",
				key: "photos/",
				hash: "hash2",
				lastModified: "--",
				timestamp: 0,
				size: "--",
				sizeRaw: 0,
				type: "folder",
				icon: "folder",
				color: "orange",
			},
		];

		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files,
			truncated: false,
			cursor: null,
		});

		const wrapper = await mountPage();
		await flushPromises();

		expect(wrapper.vm.rows).toHaveLength(2);
	});

	it("computes selectedBucket from route", async () => {
		const wrapper = await mountPage();

		expect(wrapper.vm.selectedBucket).toBe("my-bucket");
	});

	it("defines correct table columns", async () => {
		const wrapper = await mountPage();

		const colNames = wrapper.vm.columns.map((c: any) => c.name);
		expect(colNames).toEqual(["name", "lastModified", "size", "options"]);
	});

	it("navigates to folder on openObject with folder", async () => {
		const wrapper = await mountPage();
		const routerPush = vi.spyOn(wrapper.vm.$router, "push");

		wrapper.vm.openObject({
			type: "folder",
			key: "photos/",
		});

		expect(routerPush).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "files-folder",
				params: expect.objectContaining({ bucket: "my-bucket" }),
			}),
		);
	});

	it("calls fetchFilePage on created", async () => {
		await mountPage();
		await flushPromises();

		expect(apiHandler.fetchFilePage).toHaveBeenCalledWith(
			"my-bucket",
			"",
			"/",
			null,
			"",
		);
	});

	it("registers fetchFiles bus event on mount", async () => {
		const wrapper = await mountPage();

		expect(wrapper.vm.$bus.on).toHaveBeenCalledWith(
			"fetchFiles",
			expect.any(Function),
		);
	});

	it("handles search by resetting and refetching", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		vi.clearAllMocks();

		wrapper.vm.searchQuery = "test";
		wrapper.vm.handleSearch();
		await flushPromises();

		expect(apiHandler.fetchFilePage).toHaveBeenCalledWith(
			"my-bucket",
			"test",
			"/",
			null,
			"",
		);
	});

	it("clears search resets query and refetches", async () => {
		const wrapper = await mountPage();
		await flushPromises();
		vi.clearAllMocks();

		wrapper.vm.searchQuery = "test";
		wrapper.vm.clearSearch();
		await flushPromises();

		expect(wrapper.vm.searchQuery).toBe("");
		expect(apiHandler.fetchFilePage).toHaveBeenCalled();
	});

	it("loads public access status for fetched rows", async () => {
		const files = [
			{
				name: "document.pdf",
				key: "document.pdf",
				hash: "hash1",
				nameHash: "nameHash1",
				lastModified: "2 hours",
				timestamp: Date.now(),
				size: "1 KB",
				sizeRaw: 1024,
				type: "file",
				icon: "article",
				color: "grey",
			},
		];

		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files,
			truncated: false,
			cursor: null,
		});

		const wrapper = await mountPage();
		await flushPromises();

		expect(apiHandler.getPublicAccess).toHaveBeenCalledWith(
			"my-bucket",
			"document.pdf",
		);
		expect(wrapper.vm.isRowPublic(files[0])).toBe(false);
	});

	it("updates row public access state after using the row toggle", async () => {
		const files = [
			{
				name: "document.pdf",
				key: "document.pdf",
				hash: "hash1",
				nameHash: "nameHash1",
				lastModified: "2 hours",
				timestamp: Date.now(),
				size: "1 KB",
				sizeRaw: 1024,
				type: "file",
				icon: "article",
				color: "grey",
			},
		];

		vi.mocked(apiHandler.fetchFilePage).mockResolvedValue({
			files,
			truncated: false,
			cursor: null,
		});
		vi.mocked(apiHandler.setPublicAccess).mockResolvedValue({
			data: {
				key: "document.pdf",
				access: "public",
				effectiveAccess: "public",
				inheritedFrom: "document.pdf",
			},
		});

		const wrapper = await mountPage();
		await flushPromises();

		await wrapper.vm.setPublicAccessFromToggle(wrapper.vm.rows[0], true);
		await flushPromises();

		expect(apiHandler.setPublicAccess).toHaveBeenCalledWith(
			"my-bucket",
			"document.pdf",
			"public",
		);
		expect(wrapper.vm.rows[0].publicAccess.effectiveAccess).toBe("public");
		expect(wrapper.vm.isRowPublic(wrapper.vm.rows[0])).toBe(true);
	});
});
