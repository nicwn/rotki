﻿<script setup lang="ts">
import { helpers, required, requiredIf } from '@vuelidate/validators';
import dayjs from 'dayjs';
import { type Writeable } from '@/types';
import {
  type NewTrade,
  type Trade,
  type TradeType
} from '@/types/history/trade';
import { TaskType } from '@/types/task-type';
import { toMessages } from '@/utils/validation';

const props = withDefaults(
  defineProps<{
    editableItem?: Trade | null;
  }>(),
  {
    editableItem: null
  }
);

const { t } = useI18n();
const { editableItem } = toRefs(props);

const { isTaskRunning } = useTaskStore();
const { getHistoricPrice } = useBalancePricesStore();

const id = ref<string>('');
const base = ref<string>('');
const quote = ref<string>('');
const datetime = ref<string>('');
const amount = ref<string>('');
const rate = ref<string>('');
const quoteAmount = ref<string>('');
const fee = ref<string>('');
const feeCurrency = ref<string>('');
const link = ref<string>('');
const notes = ref<string>('');
const type = ref<TradeType>('buy');

const errorMessages = ref<Record<string, string[]>>({});

const quoteAmountInputFocused = ref<boolean>(false);
const feeInput = ref<any>(null);
const feeCurrencyInput = ref<any>(null);

const { assetSymbol } = useAssetInfoRetrieval();
const baseSymbol = assetSymbol(base);
const quoteSymbol = assetSymbol(quote);

const rules = {
  baseAsset: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_base').toString(),
      required
    )
  },
  quoteAsset: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_quote').toString(),
      required
    )
  },
  amount: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_amount').toString(),
      required
    )
  },
  rate: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_rate').toString(),
      required
    )
  },
  quoteAmount: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_quote_amount').toString(),
      required
    )
  },
  fee: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_fee').toString(),
      requiredIf(refIsTruthy(feeCurrency))
    )
  },
  feeCurrency: {
    required: helpers.withMessage(
      t('external_trade_form.validation.non_empty_fee_currency').toString(),
      requiredIf(refIsTruthy(fee))
    )
  }
};

const { setValidation, setSubmitFunc } = useTradesForm();

const v$ = setValidation(
  rules,
  {
    baseAsset: base,
    quoteAsset: quote,
    amount,
    rate,
    quoteAmount,
    fee,
    feeCurrency
  },
  {
    $autoDirty: true,
    $externalResults: errorMessages
  }
);

const triggerFeeValidator = () => {
  get(feeInput)?.textInput?.validate(true);
  get(feeCurrencyInput)?.autoCompleteInput?.validate(true);
};

const quoteHint = computed<string>(() =>
  get(type) === 'buy'
    ? t('external_trade_form.buy_quote').toString()
    : t('external_trade_form.sell_quote').toString()
);

const shouldRenderSummary = computed<boolean>(
  () => !!(get(type) && get(base) && get(quote) && get(amount) && get(rate))
);

const fetching = isTaskRunning(TaskType.FETCH_HISTORIC_PRICE);

const numericAmount = bigNumberifyFromRef(amount);
const numericQuoteAmount = bigNumberifyFromRef(quoteAmount);
const numericFee = bigNumberifyFromRef(fee);
const numericRate = bigNumberifyFromRef(rate);

const reset = () => {
  set(id, '');
  set(datetime, convertFromTimestamp(dayjs().unix()));
  set(amount, '');
  set(rate, '');
  set(fee, '');
  set(feeCurrency, '');
  set(link, '');
  set(notes, '');
  set(type, 'buy');
  set(errorMessages, {});
};

const setEditMode = () => {
  const trade = get(editableItem);
  if (!trade) {
    reset();
    return;
  }

  set(base, trade.baseAsset);
  set(quote, trade.quoteAsset);
  set(datetime, convertFromTimestamp(trade.timestamp));
  set(amount, trade.amount.toFixed());
  set(rate, trade.rate.toFixed());
  set(fee, trade.fee?.toFixed() ?? '');
  set(feeCurrency, trade.feeCurrency ?? '');
  set(link, trade.link ?? '');
  set(notes, trade.notes ?? '');
  set(type, trade.tradeType);
  set(id, trade.tradeId);
};

const { setMessage } = useMessageStore();

const { addExternalTrade, editExternalTrade } = useTrades();

const save = async (): Promise<boolean> => {
  const amount = get(numericAmount);
  const fee = get(numericFee);
  const rate = get(numericRate);

  const tradePayload: Writeable<NewTrade> = {
    amount: amount.isNaN() ? Zero : amount,
    fee: fee.isNaN() || fee.isZero() ? null : fee,
    feeCurrency: get(feeCurrency) || null,
    link: get(link) || null,
    notes: get(notes) || null,
    baseAsset: get(base),
    quoteAsset: get(quote),
    rate: rate.isNaN() ? Zero : rate,
    location: 'external',
    timestamp: convertToTimestamp(get(datetime)),
    tradeType: get(type)
  };

  const identifier = get(id);
  const result = !identifier
    ? await addExternalTrade(tradePayload)
    : await editExternalTrade({ ...tradePayload, tradeId: identifier });

  if (result.success) {
    reset();
    return true;
  }

  if (result.message) {
    if (typeof result.message === 'string') {
      setMessage({
        description: result.message
      });
    } else {
      set(errorMessages, result.message);
      await get(v$).$validate();
    }
  }

  return false;
};

setSubmitFunc(save);

const updateRate = (forceUpdate = false) => {
  if (
    get(amount) &&
    get(rate) &&
    (!get(quoteAmountInputFocused) || forceUpdate)
  ) {
    set(
      quoteAmount,
      get(numericAmount).multipliedBy(get(numericRate)).toFixed()
    );
  }
};

const fetchPrice = async () => {
  if (
    (get(rate) && get(editableItem)) ||
    !get(datetime) ||
    !get(base) ||
    !get(quote)
  ) {
    return;
  }

  const timestamp = convertToTimestamp(get(datetime));
  const fromAsset = get(base);
  const toAsset = get(quote);

  const rateFromHistoricPrice = await getHistoricPrice({
    timestamp,
    fromAsset,
    toAsset
  });

  if (rateFromHistoricPrice.gt(0)) {
    set(rate, rateFromHistoricPrice.toFixed());
    updateRate(true);
  } else if (!get(rate)) {
    set(errorMessages, {
      rate: [t('external_trade_form.rate_not_found').toString()]
    });
    await get(v$).rate.$validate();
    useTimeoutFn(() => {
      set(errorMessages, {});
    }, 4000);
  }
};

const onQuoteAmountChange = () => {
  if (get(amount) && get(quoteAmount) && get(quoteAmountInputFocused)) {
    set(rate, get(numericQuoteAmount).div(get(numericAmount)).toFixed());
  }
};

watch([datetime, quote, base], async () => {
  await fetchPrice();
});

watch(rate, () => {
  updateRate();
});

watch(amount, () => {
  updateRate();
  onQuoteAmountChange();
});

watch(quoteAmount, () => {
  onQuoteAmountChange();
});

watch(editableItem, setEditMode);
onMounted(setEditMode);
</script>

<template>
  <form data-cy="trade-form" class="external-trade-form">
    <DateTimePicker
      v-model="datetime"
      outlined
      limit-now
      data-cy="date"
      :label="t('external_trade_form.date.label')"
      persistent-hint
      :hint="t('external_trade_form.date.hint')"
      :error-messages="errorMessages['timestamp']"
    />

    <div class="grid md:grid-cols-3 gap-x-4 gap-y-2">
      <div data-cy="type">
        <RuiRadioGroup
          v-model="type"
          class="pt-2"
          color="primary"
          hide-details
          inline
          required
          :label="t('external_trade_form.trade_type.label')"
        >
          <RuiRadio
            :label="t('external_trade_form.trade_type.buy')"
            internal-value="buy"
            data-cy="trade-input-buy"
          />
          <RuiRadio
            :label="t('external_trade_form.trade_type.sell')"
            internal-value="sell"
            data-cy="trade-input-sell"
          />
        </RuiRadioGroup>
      </div>
      <div
        class="col-span-2 flex flex-col md:flex-row md:items-start gap-x-4 pt-4"
      >
        <AssetSelect
          v-model="base"
          class="flex-1"
          outlined
          required
          data-cy="base-asset"
          :error-messages="toMessages(v$.baseAsset)"
          :hint="t('external_trade_form.base_asset.hint')"
          :label="t('external_trade_form.base_asset.label')"
          @blur="v$.baseAsset.$touch()"
        />
        <div class="text-rui-text-secondary md:mt-4 mb-4">
          {{ quoteHint }}
        </div>
        <AssetSelect
          v-model="quote"
          class="flex-1"
          required
          outlined
          data-cy="quote-asset"
          :error-messages="toMessages(v$.quoteAsset)"
          :hint="t('external_trade_form.quote_asset.hint')"
          :label="t('external_trade_form.quote_asset.label')"
          @blur="v$.quoteAsset.$touch()"
        />
      </div>
    </div>

    <div class="mt-2">
      <AmountInput
        v-model="amount"
        required
        outlined
        class="mb-2"
        :error-messages="toMessages(v$.amount)"
        data-cy="amount"
        :label="t('common.amount')"
        :hint="t('external_trade_form.amount.hint')"
        @blur="v$.amount.$touch()"
      />
      <TwoFieldsAmountInput
        class="mb-5"
        :primary-value.sync="rate"
        :secondary-value.sync="quoteAmount"
        :loading="fetching"
        :disabled="fetching"
        data-cy="trade-rate"
        :label="{
          primary: t('external_trade_form.rate.label'),
          secondary: t('external_trade_form.quote_amount.label')
        }"
        :error-messages="{
          primary: toMessages(v$.rate),
          secondary: toMessages(v$.quoteAmount)
        }"
        @update:reversed="quoteAmountInputFocused = $event"
      />
      <div
        v-if="shouldRenderSummary"
        class="flex items-center gap-2 text-caption text-rui-success -mt-4 -mb-6 ml-3"
      >
        <RuiIcon size="16" name="chat-quote-line" />
        <i18n v-if="type === 'buy'" path="external_trade_form.summary.buy">
          <template #label>
            <strong>{{ t('external_trade_form.summary.label') }}</strong>
          </template>
          <template #amount>
            <strong>
              <AmountDisplay :value="numericAmount" :tooltip="false" />
            </strong>
          </template>
          <template #base>
            <strong>{{ baseSymbol }}</strong>
          </template>
          <template #quote>
            <strong>{{ quoteSymbol }}</strong>
          </template>
          <template #rate>
            <strong>
              <AmountDisplay :value="numericRate" :tooltip="false" />
            </strong>
          </template>
        </i18n>
        <i18n
          v-if="type === 'sell'"
          tag="span"
          path="external_trade_form.summary.sell"
        >
          <template #label>
            <strong>{{ t('external_trade_form.summary.label') }}</strong>
          </template>
          <template #amount>
            <strong>
              <AmountDisplay :value="numericAmount" :tooltip="false" />
            </strong>
          </template>
          <template #base>
            <strong>{{ baseSymbol }}</strong>
          </template>
          <template #quote>
            <strong>{{ quoteSymbol }}</strong>
          </template>
          <template #rate>
            <strong>
              <AmountDisplay :value="numericRate" :tooltip="false" />
            </strong>
          </template>
        </i18n>
      </div>
    </div>

    <RuiDivider class="mb-6 mt-8" />

    <div class="grid md:grid-cols-2 gap-x-4 gap-y-2 mb-2">
      <AmountInput
        ref="feeInput"
        v-model="fee"
        class="external-trade-form__fee"
        outlined
        data-cy="fee"
        :required="!!feeCurrency"
        :label="t('external_trade_form.fee.label')"
        :hint="t('external_trade_form.fee.hint')"
        :error-messages="toMessages(v$.fee)"
        @input="triggerFeeValidator()"
      />
      <AssetSelect
        ref="feeCurrencyInput"
        v-model="feeCurrency"
        data-cy="fee-currency"
        outlined
        persistent-hint
        :label="t('external_trade_form.fee_currency.label')"
        :hint="t('external_trade_form.fee_currency.hint')"
        :required="!!fee"
        :error-messages="toMessages(v$.feeCurrency)"
        @input="triggerFeeValidator()"
      />
    </div>

    <RuiTextField
      v-model="link"
      data-cy="link"
      variant="outlined"
      color="primary"
      prepend-icon="link"
      :label="t('external_trade_form.link.label')"
      :hint="t('external_trade_form.link.hint')"
      :error-messages="errorMessages['link']"
    />

    <RuiTextArea
      v-model="notes"
      prepend-icon="sticky-note-line"
      variant="outlined"
      color="primary"
      min-rows="5"
      data-cy="notes"
      class="mt-4"
      :label="t('external_trade_form.notes.label')"
      :hint="t('external_trade_form.notes.hint')"
      :error-messages="errorMessages['notes']"
    />
  </form>
</template>
