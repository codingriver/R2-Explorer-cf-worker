<template>
  <q-list style="min-width: 100px">
    <q-item clickable v-close-popup @click="openObject">
      <q-item-section>{{ mainStore.t("common.open") }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="downloadObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ mainStore.t("common.download") }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="renameObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ mainStore.t("common.rename") }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="duplicateObject">
      <q-item-section>{{ mainStore.t("context.duplicate") }}</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="updateMetadataObject" v-if="prop.row.type === 'file'">
      <q-item-section>{{ mainStore.t("context.updateMetadata") }}</q-item-section>
    </q-item>
    <q-separator />
    <q-item clickable v-close-popup @click="createShareLink" v-if="prop.row.type === 'file'">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.createShare") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.createShareCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="copyInternalLink">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.copyInternal") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.copyInternalCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="copyPublicUrl" v-if="prop.row.type === 'file' && bucketPublicUrl">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.copyPublic") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.copyPublicCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-separator />
    <q-item clickable v-close-popup @click="setPublicAccess('public')">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.makePublic") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.makePublicCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="setPublicAccess('private')">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.makePrivate") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.makePrivateCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="setPublicAccess('inherit')">
      <q-item-section>
        <q-item-label>{{ mainStore.t("context.inheritAccess") }}</q-item-label>
        <q-item-label caption>{{ mainStore.t("context.inheritAccessCaption") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-separator />
    <q-item clickable v-close-popup @click="deleteObject">
      <q-item-section>{{ mainStore.t("common.delete") }}</q-item-section>
    </q-item>
  </q-list>
</template>
<script>
import { useQuasar } from "quasar";
import { ROOT_FOLDER, apiHandler, decode, encode } from "src/appUtils";
import { useMainStore } from "stores/main-store";

export default {
	name: "FileContextMenu",
	props: {
		prop: {},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedFolder: function () {
			if (
				this.$route.params.folder &&
				this.$route.params.folder !== ROOT_FOLDER
			) {
				return decode(this.$route.params.folder);
			}
			return "";
		},
		bucketPublicUrl: function () {
			const bucket = this.mainStore.buckets.find(
				(b) => b.name === this.selectedBucket,
			);
			return bucket?.publicUrl || null;
		},
	},
	methods: {
		renameObject: function () {
			this.$emit("renameObject", this.prop.row);
		},
		duplicateObject: function () {
			this.$emit("duplicateObject", this.prop.row);
		},
		updateMetadataObject: function () {
			this.$emit("updateMetadataObject", this.prop.row);
		},
		openObject: function () {
			this.$emit("openObject", this.prop.row);
		},
		deleteObject: function () {
			this.$emit("deleteObject", this.prop.row);
		},
		createShareLink: function () {
			this.$emit("createShareLink", this.prop.row);
		},
		copyInternalLink: async function () {
			let url;
			if (this.prop.row.type === "folder") {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-folder",
						params: {
							bucket: this.selectedBucket,
							folder: encode(this.prop.row.key),
						},
					}).href;
			} else {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-file",
						params: {
							bucket: this.selectedBucket,
							folder: this.selectedFolder
								? encode(this.selectedFolder)
								: ROOT_FOLDER,
							file: this.prop.row.nameHash,
						},
					}).href;
			}

			try {
				await navigator.clipboard.writeText(url);
				this.q.notify({
					message: this.mainStore.t("context.linkCopied"),
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: this.mainStore.t("context.copyFailed", { error: err }),
					timeout: 5000,
					type: "negative",
				});
			}
		},
		copyPublicUrl: async function () {
			const baseUrl = this.bucketPublicUrl.replace(/\/+$/, "");
			const url = `${baseUrl}/${this.prop.row.key}`;

			try {
				await navigator.clipboard.writeText(url);
				this.q.notify({
					message: this.mainStore.t("context.publicUrlCopied"),
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: this.mainStore.t("context.copyFailed", { error: err }),
					timeout: 5000,
					type: "negative",
				});
			}
		},
		setPublicAccess: async function (access) {
			try {
				const response = await apiHandler.setPublicAccess(
					this.selectedBucket,
					this.prop.row.key,
					access,
				);
				const effectiveAccess = response.data.effectiveAccess;
				this.q.notify({
					message: this.mainStore.t("context.publicAccessNow", {
						access:
							effectiveAccess === "public"
								? this.mainStore.t("common.public")
								: this.mainStore.t("common.private"),
					}),
					caption:
						access === "inherit"
							? this.mainStore.t("context.inheritsRule")
							: this.mainStore.t("context.itemSetAccess", {
									name: this.prop.row.name,
									access:
										access === "public"
											? this.mainStore.t("common.public")
											: this.mainStore.t("common.private"),
								}),
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: this.mainStore.t("context.publicAccessFailed", {
						error: err.message || err,
					}),
					timeout: 5000,
					type: "negative",
				});
			}
		},
		downloadObject: async function () {
			try {
				const response = await apiHandler.downloadFile(
					this.selectedBucket,
					this.prop.row.key,
					{ downloadType: "objectUrl" },
				);

				const blob = new Blob([response.data]);
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.download = this.prop.row.name;
				link.href = url;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			} catch (err) {
				this.q.notify({
					message: this.mainStore.t("context.downloadFailed", {
						error: err.message || err,
					}),
					timeout: 5000,
					type: "negative",
				});
			}
		},
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
};
</script>
