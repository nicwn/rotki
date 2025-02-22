<script setup lang="ts">
import { type BigNumber } from '@rotki/common';
import { type DataTableHeader } from '@/types/vuetify';
import { CURRENCY_USD } from '@/types/currencies';
import {
  type LocationDataSnapshot,
  type LocationDataSnapshotPayload
} from '@/types/snapshots';

const props = defineProps<{
  value: LocationDataSnapshot[];
  timestamp: number;
}>();

const emit = defineEmits<{
  (e: 'update:step', step: number): void;
  (e: 'input', value: LocationDataSnapshot[]): void;
}>();

const { t } = useI18n();

type IndexedLocationDataSnapshot = LocationDataSnapshot & { index: number };

const { value, timestamp } = toRefs(props);
const { currencySymbol } = storeToRefs(useGeneralSettingsStore());
const editedIndex = ref<number | null>(null);
const form = ref<LocationDataSnapshotPayload | null>(null);
const excludedLocations = ref<string[]>([]);

const tableHeaders = computed<DataTableHeader[]>(() => [
  {
    text: t('common.location'),
    value: 'location',
    cellClass: 'py-2',
    width: 200,
    align: 'center'
  },
  {
    text: t('common.value_in_symbol', {
      symbol: get(currencySymbol)
    }),
    value: 'usdValue',
    align: 'end',
    sort: (a: BigNumber, b: BigNumber) => sortDesc(a, b)
  },
  {
    text: '',
    value: 'action',
    cellClass: 'py-2',
    width: 100,
    sortable: false
  }
]);

const { exchangeRate } = useBalancePricesStore();
const fiatExchangeRate = computed<BigNumber>(
  () => get(exchangeRate(get(currencySymbol))) ?? One
);

const data = computed<IndexedLocationDataSnapshot[]>(() =>
  get(value)
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.location !== 'total')
);

const input = (value: LocationDataSnapshot[]) => {
  emit('input', value);
};

const updateStep = (step: number) => {
  emit('update:step', step);
};

const editClick = (item: IndexedLocationDataSnapshot) => {
  set(editedIndex, item.index);

  const convertedFiatValue =
    get(currencySymbol) === CURRENCY_USD
      ? item.usdValue.toFixed()
      : item.usdValue.multipliedBy(get(fiatExchangeRate)).toFixed();

  set(form, {
    ...item,
    usdValue: convertedFiatValue
  });

  set(
    excludedLocations,
    get(value)
      .map(item => item.location)
      .filter(identifier => identifier !== item.location)
  );

  setOpenDialog(true);
};

const add = () => {
  set(editedIndex, null);
  set(form, {
    timestamp: get(timestamp),
    location: '',
    usdValue: ''
  });
  set(
    excludedLocations,
    get(value).map(item => item.location)
  );
  setOpenDialog(true);
};

const {
  openDialog,
  setOpenDialog,
  closeDialog,
  submitting,
  setSubmitFunc,
  trySubmit
} = useEditLocationsSnapshotForm();

const save = async () => {
  const formVal = get(form);

  if (!formVal) {
    return;
  }

  const index = get(editedIndex);
  const val = get(value);
  const timestampVal = get(timestamp);

  const convertedUsdValue =
    get(currencySymbol) === CURRENCY_USD
      ? bigNumberify(formVal.usdValue)
      : bigNumberify(formVal.usdValue).dividedBy(get(fiatExchangeRate));

  const newValue = [...val];
  const payload = {
    timestamp: timestampVal,
    location: formVal.location,
    usdValue: convertedUsdValue
  };

  if (index !== null) {
    newValue[index] = payload;
  } else {
    newValue.unshift(payload);
  }

  input(newValue);
  clearEditDialog();
};

setSubmitFunc(save);

const clearEditDialog = () => {
  closeDialog();
  set(editedIndex, null);
  set(form, null);
  set(excludedLocations, []);
};

const updateForm = (newForm: LocationDataSnapshotPayload) => {
  set(form, newForm);
};

const confirmDelete = (index: number) => {
  const val = get(value);

  if (index === null) {
    return;
  }

  const newValue = [...val];
  newValue.splice(index, 1);

  input(newValue);
};

const total = computed<BigNumber>(() => {
  const totalEntry = get(value).find(item => item.location === 'total');

  if (!totalEntry) {
    return Zero;
  }
  return totalEntry.usdValue;
});

const { show } = useConfirmStore();

const showDeleteConfirmation = (item: IndexedLocationDataSnapshot) => {
  show(
    {
      title: t('dashboard.snapshot.edit.dialog.location_data.delete_title'),
      message: t(
        'dashboard.snapshot.edit.dialog.location_data.delete_confirmation'
      )
    },
    () => confirmDelete(item.index)
  );
};
</script>

<template>
  <div>
    <DataTable
      class="table-inside-dialog"
      :headers="tableHeaders"
      :items="data"
      :mobile-breakpoint="0"
      flat
      disable-floating-header
    >
      <template #item.location="{ item }">
        <LocationDisplay :opens-details="false" :identifier="item.location" />
      </template>

      <template #item.usdValue="{ item }">
        <AmountDisplay :value="item.usdValue" fiat-currency="USD" />
      </template>

      <template #item.action="{ item }">
        <RowActions
          :edit-tooltip="t('dashboard.snapshot.edit.dialog.actions.edit_item')"
          :delete-tooltip="
            t('dashboard.snapshot.edit.dialog.actions.delete_item')
          "
          @edit-click="editClick(item)"
          @delete-click="showDeleteConfirmation(item)"
        />
      </template>
    </DataTable>
    <div
      class="border-t-2 border-rui-grey-300 dark:border-rui-grey-800 relative z-[2] flex items-center justify-between gap-4 p-2"
    >
      <div>
        <div class="text-caption">{{ t('common.total') }}:</div>
        <div class="font-bold text-h6 -mt-1">
          <AmountDisplay :value="total" fiat-currency="USD" />
        </div>
      </div>

      <div class="flex gap-2">
        <RuiButton variant="text" color="primary" @click="add()">
          <template #prepend>
            <RuiIcon name="add-circle-line" />
          </template>
          {{ t('dashboard.snapshot.edit.dialog.actions.add_new_entry') }}
        </RuiButton>
        <RuiButton variant="text" @click="updateStep(1)">
          <template #prepend>
            <RuiIcon name="arrow-left-line" />
          </template>
          {{ t('common.actions.back') }}
        </RuiButton>
        <RuiButton color="primary" @click="updateStep(3)">
          {{ t('common.actions.next') }}
          <template #append>
            <RuiIcon name="arrow-right-line" />
          </template>
        </RuiButton>
      </div>
    </div>

    <BigDialog
      :display="openDialog"
      :title="
        editedIndex !== null
          ? t('dashboard.snapshot.edit.dialog.location_data.edit_title')
          : t('dashboard.snapshot.edit.dialog.location_data.add_title')
      "
      :primary-action="t('common.actions.save')"
      :loading="submitting"
      @confirm="trySubmit()"
      @cancel="clearEditDialog()"
    >
      <EditLocationDataSnapshotForm
        v-if="form"
        :form="form"
        :excluded-locations="excludedLocations"
        @update:form="updateForm($event)"
      />
    </BigDialog>
  </div>
</template>
