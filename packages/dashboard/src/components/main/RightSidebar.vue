<template>
  <div class=" fit">
    <q-table
      class="fit"
      :title="mainStore.t('common.info')"
      :rows="rows"
      :columns="columns"
      row-key="name"

      :hide-pagination="true"
      :rows-per-page-options="[0]"
      :flat="true"
    >
      <slot name="top-right">
        <q-btn dense flat round icon="menu" />
      </slot>
    </q-table>
  </div>
</template>

<script>
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "RightSidebar",
	data: () => ({
		rows: [],
	}),
	methods: {
		openFileDetails: (row) => {
			// this.$emit('updateDrawer', true)  // TODO: enable
			// console.log(row)
		},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedApp: function () {
			return this.$route.name?.split("-")[0] || "files";
		},
		columns: function () {
			return [
				{
					name: "name",
					required: true,
					label: this.mainStore.t("common.name"),
					align: "left",
					field: (row) => row.name,
					format: (val) => `${val}`,
					sortable: true,
				},
				{
					name: "status",
					align: "center",
					label: this.mainStore.t("common.status"),
					field: "status",
					sortable: true,
				},
			];
		},
	},
	mounted() {
		this.$bus.on("openFileDetails", this.openFileDetails);
	},
	beforeUnmount() {
		this.$bus.off("openFileDetails");
	},
	setup() {
		const mainStore = useMainStore();

		return {
			mainStore,
		};
	},
});
</script>
