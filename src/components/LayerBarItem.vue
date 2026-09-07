<script setup lang="ts">
import { Icon } from "@iconify/vue";
import Button from "./internals/Button.vue";
import * as Y from "yjs";
import { useSyncMap } from "../composables/useSync";
import { ElementKV } from "../element/element";
import { LayerKV } from "../layer/layer";

const props = defineProps<{
    type: "element" | "layer";
    item: Y.Map<any>;
}>();

const emit = defineEmits<{
    handleSelect: [id: string];
    handleDelete: [id: string];
}>();

const itemMap = useSyncMap<ElementKV | LayerKV>(props.item, [
    "id",
    "name",
    "type"
]);
</script>

<template>
    <div class="item">
        <button
            type="button"
            class="item-main"
            :aria-label="`选择${itemMap.name.value || '未命名'}图层`"
            @click="emit('handleSelect', itemMap.id.value)"
        >
            <span class="item-name">{{ itemMap.name.value || "未命名" }}</span>
            <span class="item-type">{{ itemMap.type.value }}</span>
        </button>
        <Button
            class="delete-button"
            :aria-label="`删除${itemMap.name.value || '未命名'}图层`"
            @click="emit('handleDelete', itemMap.id.value)"
        >
            <Icon icon="material-symbols:delete-outline" />
        </Button>
    </div>
</template>

<style scoped>
.item {
    display: flex;
    min-height: 52px;
    align-items: center;
    gap: 6px;
    margin: 6px 0;
    padding: 5px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: rgba(30, 41, 59, 0.58);
    transition:
        border-color var(--ui-transition),
        background-color var(--ui-transition);
}

.item:hover {
    border-color: var(--ui-border);
    background: rgba(51, 65, 85, 0.64);
}

.item-main {
    all: unset;
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    cursor: pointer;
}

.item-name {
    width: 100%;
    overflow: hidden;
    color: var(--ui-text);
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-type {
    color: var(--ui-text-muted);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
    line-height: 1.25;
}

.item :deep(.delete-button) {
    width: 38px;
    min-width: 38px;
    height: 38px;
    min-height: 38px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--ui-text-muted);
}

.item :deep(.delete-button:hover) {
    border-color: rgba(248, 113, 113, 0.34);
    background: rgba(248, 113, 113, 0.12);
    color: #fecaca;
}

@media (max-width: 920px) {
    .item :deep(.delete-button) {
        width: 44px;
        min-width: 44px;
        height: 44px;
        min-height: 44px;
    }
}
</style>
