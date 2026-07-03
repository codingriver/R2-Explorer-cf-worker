<template>
  <div class="q-pa-md" style="height: 100%">
    <div class="flex column" style="height: 100%">
      <q-btn v-if="mainStore.apiReadonly" color="red" stack class="q-mb-lg" :label="mainStore.t('nav.readOnly')" />
      <q-btn v-else color="green" icon="add" stack class="q-mb-lg" :label="mainStore.t('nav.new')">
        <q-menu>
          <q-list>
            <q-item clickable v-close-popup @click="$refs.createFile.open()">
              <q-item-section>
                <q-item-label>
                  <q-icon name="note_add" size="sm" />
                  {{ mainStore.t("nav.newFile") }}
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="$refs.createFolder.open()">
              <q-item-section>
                <q-item-label>
                  <q-icon name="create_new_folder" size="sm" />
                  {{ mainStore.t("nav.newFolder") }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable v-close-popup @click="$bus.emit('openFilesUploader')">
              <q-item-section>
                <q-item-label>
                  <q-icon name="upload_file" size="sm" />
                  {{ mainStore.t("nav.uploadFiles") }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable v-close-popup @click="$bus.emit('openFoldersUploader')">
              <q-item-section>
                <q-item-label>
                  <q-icon name="folder" size="sm" />
                  {{ mainStore.t("nav.uploadFolders") }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn class="q-mb-sm" @click="gotoFiles" color="blue" icon="folder_copy" :label="mainStore.t('nav.files')" stack />
      <q-btn v-if="mainStore.config && mainStore.config.emailRouting !== false" class="q-mb-sm" @click="gotoEmail" color="blue" icon="email" :label="mainStore.t('nav.email')" stack />

      <q-btn class="q-mb-sm q-mt-auto" color="purple" icon="translate" :label="mainStore.t('common.language')" stack>
        <q-menu>
          <q-list>
            <q-item v-for="locale in mainStore.locales" :key="locale.value" clickable v-close-popup @click="mainStore.setLocale(locale.value)">
              <q-item-section>
                <q-item-label>{{ locale.label }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn class="q-mb-sm q-mb-0" @click="infoPopup=true" color="secondary" icon="question_mark"
             :label="mainStore.t('common.info')"
             stack />
    </div>
  </div>

  <q-dialog v-model="infoPopup" persistent no-route-dismiss>
    <q-card>
      <q-card-section>
        <div class="text-h6">{{ mainStore.t("info.thanks") }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        {{ mainStore.t("info.version", { version: mainStore.version }) }}<br>
        <template v-if="updateAvailable">
          {{ mainStore.t("info.updateAvailable", { version: latestVersion }) }} <a href="https://r2explorer.com/getting-started/updating-your-project/" target="_blank">r2explorer.com</a>.<br>
        </template>
        <br>
        <template v-if="mainStore.auth">
          <b>{{ mainStore.t("info.auth") }}</b><br>
          {{ mainStore.t("info.authMethod") }}: {{ mainStore.auth.type }}<br>
          {{ mainStore.t("info.authUsername") }}: {{ mainStore.auth.username }}
        </template>
        <template v-else>
          {{ mainStore.t("info.notAuthenticated") }}
        </template>
        <br><br>
        <b>{{ mainStore.t("info.serverConfig") }}</b><br>
        {{ JSON.stringify(mainStore.config, null, 2) }}
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="mainStore.t('common.ok')" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <create-folder ref="createFolder" />
  <create-file ref="createFile" />
</template>

<script>
import CreateFile from "components/files/CreateFile.vue";
import CreateFolder from "components/files/CreateFolder.vue";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "LeftSidebar",
	data: () => ({
		infoPopup: false,
		updateAvailable: false,
		latestVersion: "",
	}),
	components: { CreateFolder, CreateFile },
	methods: {
		gotoEmail: function () {
			if (this.selectedApp !== "email") this.changeApp("email");
		},
		gotoFiles: function () {
			if (this.selectedApp !== "files") this.changeApp("files");
		},
		changeApp: function (app) {
			this.$router.push({
				name: `${app}-home`,
				params: { bucket: this.selectedBucket },
			});
		},
		isUpdateAvailable: (currentVersion, latestVersion) => {
			// Split versions into parts and convert to numbers
			const current = currentVersion.split(".").map(Number);
			const latest = latestVersion.split(".").map(Number);

			// Compare major version
			if (latest[0] > current[0]) return true;
			if (latest[0] < current[0]) return false;

			// Compare minor version
			if (latest[1] > current[1]) return true;
			if (latest[1] < current[1]) return false;

			// Compare patch version
			if (latest[2] > current[2]) return true;

			return false;
		},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedApp: function () {
			return this.$route.name?.split("-")[0] || "files";
		},
	},
	async mounted() {
		const resp = await fetch(
			"https://api.github.com/repos/G4brym/R2-Explorer/releases/latest",
		);
		if (!resp.ok) {
			console.log("Unable to retrieve latest r2-explorer updates :(");
			console.log(
				"Manually check them here: https://github.com/G4brym/R2-Explorer/releases",
			);
		} else {
			const parsed = await resp.json();
			const latestVersion = parsed.tag_name.replace("v", "");
			if (this.isUpdateAvailable(this.mainStore.version, latestVersion)) {
				this.latestVersion = latestVersion;
				this.updateAvailable = true;
			}
		}
	},
	setup() {
		const mainStore = useMainStore();

		return {
			mainStore,
		};
	},
});
</script>

<style scoped>
.q-btn {
  max-width: 100%;
  padding: 4px;
}
</style>
