<template>
  <q-page class="flex flex-center">
    <q-inner-loading
      :showing="true"
      :label="loadingLabel"
    />
  </q-page>
</template>

<script>
import { useAuthStore } from "stores/auth-store";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "HomePage",
	data: () => ({
		loadingLabel: "",
	}),
	methods: {
		async openFirstBucket() {
			if (this.mainStore.buckets.length > 0) {
				await this.$router.replace({
					name: "files-home",
					params: { bucket: this.mainStore.buckets[0].name },
				});
				return true;
			}
			return false;
		},
		async initializeAuth() {
			if (await this.openFirstBucket()) {
				return;
			}

			const authStore = useAuthStore();
			const authResp = await authStore.CheckLoginInStorage(
				this.$router,
				this.$q,
			);

			if (authResp === false) {
				await this.mainStore.loadServerConfigs(this.$router, this.$q, true);
			}

			if (!(await this.openFirstBucket())) {
				this.loadingLabel = "No R2 bucket binding found.";
			}
		},
	},
	mounted() {
		this.initializeAuth().catch((error) => {
			console.error("Unable to initialize authentication", error);
		});
	},
	setup() {
		return {
			mainStore: useMainStore(),
		};
	},
	created() {
		this.loadingLabel = this.mainStore.t("common.loading");
	},
});
</script>
