<script setup lang="ts">
import useVuelidate from '@vuelidate/core';
import { helpers, required } from '@vuelidate/validators';
import { type Tag, type TagEvent } from '@/types/tags';
import { toMessages } from '@/utils/validation';

const props = defineProps<{
  tag: Tag;
  editMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'changed', tag: Tag): void;
  (e: 'save', tag: Tag): void;
  (e: 'cancel'): void;
}>();
const { t } = useI18n();

const { tag } = toRefs(props);

const rules = {
  name: {
    required: helpers.withMessage(
      t('tag_creator.validation.empty_name'),
      required
    )
  },
  description: {
    optional: () => true
  }
};

const v$ = useVuelidate(
  rules,
  {
    name: useRefMap(tag, tag => tag.name),
    description: useRefMap(tag, tag => tag.description)
  },
  { $autoDirty: true }
);

const changed = (event: TagEvent) => {
  emit('changed', {
    ...props.tag,
    ...event
  });
};

const save = async () => {
  const v = get(v$);
  if (!(await v.$validate())) {
    return;
  }
  emit('save', props.tag);
};

const cancel = async () => {
  emit('cancel');
};

const randomize = () => {
  const backgroundColor = randomColor();
  changed({
    backgroundColor,
    foregroundColor: invertColor(backgroundColor)
  });
};

watch(tag, () => {
  get(v$).$reset();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <TagIcon class="min-w-[7rem]" :tag="tag" />
      <RuiTooltip :popper="{ placement: 'bottom' }">
        <template #activator>
          <RuiButton
            icon
            size="sm"
            variant="text"
            color="primary"
            @click="randomize()"
          >
            <RuiIcon name="shuffle-line" />
          </RuiButton>
        </template>
        {{ t('tag_creator.refresh_tooltip') }}
      </RuiTooltip>
    </div>
    <div class="mt-4">
      <RuiTextField
        variant="outlined"
        color="primary"
        class="tag_creator__name"
        :label="t('common.name')"
        :error-messages="toMessages(v$.name)"
        :value="tag.name"
        :disabled="editMode"
        @input="changed({ name: $event })"
      />
      <RuiTextField
        variant="outlined"
        color="primary"
        class="tag_creator__description"
        :value="tag.description"
        :label="t('common.description')"
        @input="changed({ description: $event })"
      />
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <RuiCard class="flex flex-col items-center">
        <template #header>
          {{ t('tag_creator.labels.foreground') }}
        </template>
        <VColorPicker
          flat
          class="w-full"
          data-cy="tag-creator__color-picker__foreground"
          mode="hexa"
          hide-mode-switch
          :value="`#${tag.foregroundColor}`"
          @update:color="
            changed({ foregroundColor: $event.hex.replace('#', '') })
          "
        />
      </RuiCard>
      <RuiCard class="flex flex-col items-center">
        <template #header>
          {{ t('tag_creator.labels.background') }}
        </template>
        <VColorPicker
          flat
          data-cy="tag-creator__color-picker__background"
          hide-mode-switch
          mode="hexa"
          :value="`#${tag.backgroundColor}`"
          @update:color="
            changed({ backgroundColor: $event.hex.replace('#', '') })
          "
        />
      </RuiCard>
    </div>

    <div class="flex justify-end gap-4">
      <RuiButton v-if="editMode" width="100" @click="cancel()">
        {{ t('common.actions.cancel') }}
      </RuiButton>
      <RuiButton
        data-cy="tag-creator__buttons__save"
        color="primary"
        :disabled="v$.$invalid"
        @click="save()"
      >
        {{ t('common.actions.save') }}
      </RuiButton>
    </div>
  </div>
</template>
