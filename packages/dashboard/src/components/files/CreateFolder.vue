<template>
  <q-dialog v-model="modal" @hide="cancel">
    <q-card style="min-width: 350px">
      <q-form
        @submit="onSubmit"
      >
        <q-card-section>
          <div class="text-h6">{{ mainStore.t("create.folderName") }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input dense v-model="newFolderName" autofocus
                   lazy-rules
                   :rules="[ val => val && val.length > 0 || mainStore.t('create.required')]" />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat :label="mainStore.t('common.cancel')" v-close-popup />
          <q-btn flat :label="mainStore.t('common.create')" type="submit" :loading="loading" />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { ROOT_FOLDER, apiHandler, decode } from "src/appUtils";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "CreateFolder",
	data: () => ({
		modal: false,
		newFolderName: "",
		loading: false,
	}),
	methods: {
		cancel: function () {
			this.modal = false;
			this.newFolderName = "";
			this.loading = false;
		},
		onSubmit: async function () {
			this.loading = true;
			try {
				await apiHandler.createFolder(
					`${this.selectedFolder + this.newFolderName}/`,
					this.selectedBucket,
				);
				this.$bus.emit("fetchFiles");
				this.modal = false;
				this.newFolderName = "";
			} catch (error) {
				this.q.notify({
					type: "negative",
					message:
						error?.response?.data?.message ||
						error?.response?.data ||
						error?.message ||
						this.mainStore.t("create.failedFolder"),
					timeout: 10000,
				});
			} finally {
				this.loading = false;
			}
		},
		open: function () {
			this.modal = true;
		},
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
	},
	setup() {
		const mainStore = useMainStore();
		const q = useQuasar();

		return {
			mainStore,
			q,
		};
	},
});
</script>
