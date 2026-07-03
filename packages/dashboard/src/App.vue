<template>
  <router-view />
</template>

<script>
import { useAuthStore } from "stores/auth-store";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "App",
	methods: {
		async initializeAuth() {
			const authStore = useAuthStore();
			const authResp = await authStore.CheckLoginInStorage(
				this.$router,
				this.$q,
			);

			if (authResp === false) {
				const mainStore = useMainStore();
				await mainStore.loadServerConfigs(this.$router, this.$q, true);
			}
		},
	},
	mounted() {
		this.initializeAuth().catch((error) => {
			console.error("Unable to initialize authentication", error);
		});
	},
});
</script>
