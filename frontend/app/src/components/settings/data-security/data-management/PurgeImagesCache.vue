<script setup lang="ts">
import { type ComputedRef, type Ref } from 'vue';
import { PurgeableImageCache } from '@/types/session/purge';

const { t } = useI18n();

const purgable = [
  {
    id: PurgeableImageCache.ASSET_ICONS,
    text: t('data_management.purge_images_cache.label.asset_icons')
  },
  {
    id: PurgeableImageCache.ENS_AVATARS,
    text: t('data_management.purge_images_cache.label.ens_avatars')
  }
];

const source: Ref<PurgeableImageCache> = ref(PurgeableImageCache.ASSET_ICONS);

const assetToClear: Ref<string> = ref('');
const ensToClear: Ref<string[]> = ref([]);

const { ensNames } = storeToRefs(useAddressesNamesStore());

const ensNamesList: ComputedRef<string[]> = computed(
  () => Object.values(get(ensNames)).filter(value => !!value) as string[]
);

const { clearIconCache } = useAssetIconApi();
const { setLastRefreshedAssetIcon } = useAssetIcon();
const { clearEnsAvatarCache } = useAddressesNamesApi();
const { setLastRefreshedAvatar } = useAddressesNamesStore();

const purgeSource = async (source: PurgeableImageCache) => {
  if (source === PurgeableImageCache.ASSET_ICONS) {
    const asset = get(assetToClear);
    await clearIconCache(asset ? [asset] : null);
    setLastRefreshedAssetIcon();
    set(assetToClear, '');
  } else {
    const ens = get(ensToClear);
    await clearEnsAvatarCache(ens.length > 0 ? ens : null);
    setLastRefreshedAvatar();
    set(ensToClear, []);
  }
};

const { status, pending, showConfirmation } =
  useCacheClear<PurgeableImageCache>(
    purgable,
    purgeSource,
    (source: string) => ({
      success: t('data_management.purge_images_cache.success', {
        source
      }),
      error: t('data_management.purge_images_cache.error', {
        source
      })
    }),
    (source: string) => ({
      title: t('data_management.purge_images_cache.confirm.title'),
      message: t('data_management.purge_images_cache.confirm.message', {
        source
      })
    })
  );

const css = useCssModule();
</script>

<template>
  <div>
    <RuiCardHeader class="p-0 mb-4">
      <template #header>
        {{ t('data_management.purge_images_cache.title') }}
      </template>
      <template #subheader>
        {{ t('data_management.purge_images_cache.subtitle') }}
      </template>
    </RuiCardHeader>

    <div class="flex items-center gap-4">
      <div class="flex flex-col md:flex-row md:gap-4 flex-1">
        <VAutocomplete
          v-model="source"
          class="flex-1"
          outlined
          :label="t('data_management.purge_images_cache.select_image_source')"
          :items="purgable"
          item-text="text"
          item-value="id"
          :disabled="pending"
        />
        <AssetSelect
          v-if="source === PurgeableImageCache.ASSET_ICONS"
          v-model="assetToClear"
          class="flex-1"
          outlined
          persistent-hint
          :label="t('data_management.purge_images_cache.label.asset_to_clear')"
          :hint="t('data_management.purge_images_cache.hint')"
        />
        <VCombobox
          v-else
          v-model="ensToClear"
          class="flex-1"
          :items="ensNamesList"
          outlined
          :class="css['ens-input']"
          chips
          deletable-chips
          clearable
          :label="t('data_management.purge_images_cache.label.ens_to_clear')"
          :hint="t('data_management.purge_images_cache.hint')"
          multiple
          persistent-hint
        />
      </div>

      <RuiTooltip
        :popper="{ placement: 'top' }"
        :open-delay="400"
        class="-mt-8"
      >
        <template #activator>
          <RuiButton
            variant="text"
            icon
            :disabled="!source || pending"
            :loading="pending"
            @click="showConfirmation(source)"
          >
            <RuiIcon name="delete-bin-line" />
          </RuiButton>
        </template>
        <span> {{ t('data_management.purge_images_cache.tooltip') }} </span>
      </RuiTooltip>
    </div>

    <ActionStatusIndicator v-if="status" :status="status" />
  </div>
</template>

<style module lang="scss">
.ens-input {
  :global {
    .v-select {
      &__selections {
        min-height: auto !important;
      }
    }
  }
}
</style>
