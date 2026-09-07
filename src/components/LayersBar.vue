<script setup lang="ts">
import { Label } from "radix-vue";
import Separator from "./internals/Separator.vue";
import Select from "./internals/Select.vue";
import LayerBarItem from "./LayerBarItem.vue";
import { useLayersBar } from "../composables/useLayersBar";
import { TerrainOption } from "../editor/terrain";

const {
    selectedTerrain,
    selectedBaseLayer,
    elementArray,
    layersArray,
    imageryLayersArray,
    handleSelect,
    handleDelete,
    selectTerrain
} = useLayersBar();

const baseMapOptions = ["Bing", "ArcGIS", "Local"];
const terrainOptions = Object.values(TerrainOption);
</script>

<template>
    <aside class="layersbar" aria-label="场景图层">
        <div class="left-panel">
            <h2>影像图层</h2>
            <div class="layer-control-row">
                <Label>底图</Label>
                <Select
                    title="BaseMap"
                    :selected="selectedBaseLayer"
                    :select-options="baseMapOptions"
                    @update:model-value="selectedBaseLayer = $event"
                ></Select>
            </div>
            <Separator />
            <div class="layer-control-row">
                <Label>地形</Label>
                <Select
                    title="地形"
                    :selected="selectedTerrain"
                    :select-options="terrainOptions"
                    @update:model-value="selectTerrain($event as TerrainOption)"
                ></Select>
            </div>
            <LayerBarItem
                type="layer"
                v-for="(e, index) in imageryLayersArray"
                :key="e.get('id') as string"
                :index="index"
                :item="e"
                @handle-select="handleSelect"
                @handle-delete="handleDelete"
            />
            <Separator />
            <h2>其他图层</h2>
            <LayerBarItem
                type="layer"
                v-for="e in layersArray"
                :key="e.get('id')"
                :item="e"
                @handle-select="handleSelect"
                @handle-delete="handleDelete"
            />
            <Separator />
            <h2>元素</h2>
            <LayerBarItem
                type="element"
                v-for="e in elementArray"
                :key="e.get('id') as string"
                :item="e"
                @handle-select="handleSelect"
                @handle-delete="handleDelete"
            />
        </div>
    </aside>
</template>

<style scoped>
.layersbar {
    position: fixed;
    z-index: var(--ui-z-panel);
    top: 82px;
    bottom: 14px;
    left: 14px;
    width: 260px;
    overflow: hidden;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
    color: var(--ui-text-secondary);
}

.left-panel {
    height: 100%;
    overflow-y: auto;
    padding: 14px;
}

.layersbar h2 {
    margin: 14px 0 10px;
    color: var(--ui-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.layersbar h2:first-child {
    margin-top: 0;
}

.layer-control-row {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    margin: 8px 0;
}

.layer-control-row > :first-child {
    color: var(--ui-text-muted);
    font-size: 12px;
}

.layer-control-row :deep(.SelectTrigger) {
    width: 100%;
}

@media (max-width: 920px) {
    .layersbar {
        top: 70px;
        bottom: 8px;
        left: 8px;
        width: 224px;
    }
}

@media (max-width: 620px) {
    .layersbar {
        bottom: auto;
        width: calc(50vw - 12px);
        max-height: 42vh;
    }
}
</style>
