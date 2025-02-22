<script setup lang="ts">
import { type BigNumber } from '@rotki/common';
import { type Message } from '@rotki/common/lib/messages';
import dayjs from 'dayjs';

const props = withDefaults(
  defineProps<{
    value?: boolean;
    timestamp?: number;
    balance?: number;
  }>(),
  {
    value: false,
    timestamp: 0,
    balance: 0
  }
);

const emit = defineEmits<{
  (e: 'input', visible: boolean): void;
}>();

const { timestamp, balance } = toRefs(props);
const { currencySymbol } = storeToRefs(useGeneralSettingsStore());
const editMode = ref<boolean>(false);

const updateVisibility = (visible: boolean) => {
  emit('input', visible);
};

const formattedSelectedBalance = computed<BigNumber | null>(() => {
  if (get(balance)) {
    return get(bigNumberifyFromRef(balance));
  }

  return null;
});

const downloadSnapshot = async () => {
  const response = await snapshotApi.downloadSnapshot(get(timestamp));

  const date = dayjs(get(timestamp) * 1000).format('YYYYDDMMHHmmss');
  const fileName = `${date}-snapshot.zip`;

  downloadFileByBlobResponse(response, fileName);

  updateVisibility(false);
};

const { setMessage } = useMessageStore();

const { t } = useI18n();

const snapshotApi = useSnapshotApi();
const { appSession, openDirectory } = useInterop();

const exportSnapshotCSV = async () => {
  let message: Message | null = null;

  try {
    if (appSession) {
      const path = await openDirectory(t('common.select_directory').toString());

      if (!path) {
        return;
      }

      const success = await snapshotApi.exportSnapshotCSV({
        path,
        timestamp: get(timestamp)
      });

      message = {
        title: t('dashboard.snapshot.download.message.title').toString(),
        description: success
          ? t('dashboard.snapshot.download.message.success').toString()
          : t('dashboard.snapshot.download.message.failure').toString(),
        success
      };

      updateVisibility(false);
    } else {
      await downloadSnapshot();
    }
  } catch (e: any) {
    message = {
      title: t('dashboard.snapshot.download.message.title').toString(),
      description: e.message,
      success: false
    };
  }

  if (message) {
    setMessage(message);
  }
};

const exportSnapshot = async () => {
  if (appSession) {
    await exportSnapshotCSV();
  } else {
    await downloadSnapshot();
  }
};

const { fetchNetValue } = useStatisticsStore();

const deleteSnapshot = async () => {
  let message: Message | null;

  try {
    const success = await snapshotApi.deleteSnapshot({
      timestamp: get(timestamp)
    });

    message = {
      title: t('dashboard.snapshot.delete.message.title').toString(),
      description: success
        ? t('dashboard.snapshot.delete.message.success').toString()
        : t('dashboard.snapshot.delete.message.failure').toString(),
      success
    };

    updateVisibility(false);
    await fetchNetValue();
  } catch (e: any) {
    message = {
      title: t('dashboard.snapshot.download.message.title').toString(),
      description: e.message,
      success: false
    };
  }

  setMessage(message);
};

const finish = () => {
  updateVisibility(false);
  set(editMode, false);
};

const { show } = useConfirmStore();

const showDeleteConfirmation = () => {
  show(
    {
      title: t('dashboard.snapshot.delete.dialog.title'),
      message: t('dashboard.snapshot.delete.dialog.message')
    },
    deleteSnapshot
  );
};
</script>

<template>
  <VDialog :value="value" max-width="600" @input="updateVisibility($event)">
    <RuiCard>
      <template #header>
        {{ t('dashboard.snapshot.export_database_snapshot') }}
      </template>
      <template #subheader>
        {{ t('dashboard.snapshot.subtitle') }}
      </template>
      <div>
        <div class="text-rui-text-secondary">{{ t('common.datetime') }}:</div>
        <DateDisplay :timestamp="timestamp" class="font-bold" />
      </div>
      <div class="pt-2">
        <div class="text-rui-text-secondary">{{ t('common.balance') }}:</div>
        <AmountDisplay
          v-if="formattedSelectedBalance"
          :value="formattedSelectedBalance"
          :fiat-currency="currencySymbol"
          class="font-bold"
        />
      </div>
      <template #footer>
        <RuiButton color="primary" @click="editMode = true">
          <template #prepend>
            <RuiIcon name="edit-line" />
          </template>
          {{ t('common.actions.edit') }}
        </RuiButton>
        <RuiButton color="error" @click="showDeleteConfirmation()">
          <template #prepend>
            <RuiIcon name="delete-bin-5-line" />
          </template>
          {{ t('common.actions.delete') }}
        </RuiButton>
        <div class="grow" />
        <RuiButton color="primary" @click="exportSnapshot()">
          <template #prepend>
            <RuiIcon name="file-download-line" />
          </template>
          {{ t('common.actions.download') }}
        </RuiButton>
      </template>
    </RuiCard>
    <EditSnapshotDialog
      v-if="editMode"
      :timestamp="timestamp"
      @close="editMode = false"
      @finish="finish()"
    />
  </VDialog>
</template>
