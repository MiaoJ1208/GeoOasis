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
    <div class="layersbar">
        <div class="left-panel">
            <h3>影像图层</h3>
            <Label>底图:</Label>
            <Select
                title="BaseMap"
                :selected="selectedBaseLayer"
                :select-options="baseMapOptions"
                @update:model-value="selectedBaseLayer = $event"
            ></Select>
            <Separator />
            <Label>地形:</Label>
            <Select
                title="地形"
                :selected="selectedTerrain"
                :select-options="terrainOptions"
                @update:model-value="selectTerrain($event as TerrainOption)"
            ></Select>
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
            <h3>其他图层</h3>
            <LayerBarItem
                type="layer"
                v-for="e in layersArray"
                :key="e.get('id')"
                :item="e"
                @handle-select="handleSelect"
                @handle-delete="handleDelete"
            />
            <Separator />
            <h3>元素</h3>
            <LayerBarItem
                type="element"
                v-for="e in elementArray"
                :key="e.get('id') as string"
                :item="e"
                @handle-select="handleSelect"
                @handle-delete="handleDelete"
            />
        </div>
    </div>
</template>

<style scoped>
.layersbar {
    position: fixed;
    left: 30px;
    top: 100px;
    bottom: 50px;

    width: 190px;

    background-color: rgba(6, 18, 44, 0.92);
    box-shadow: 0 0 24px rgba(62, 147, 255, 0.55);
    border: 1px solid rgba(53, 121, 226, 0.9);
    border-radius: 14px;
    padding: 14px;
    color: #d9ebff;
}

.left-panel {
    background: rgba(11, 26, 57, 0.86);
    border: 1px solid rgba(82, 146, 255, 0.7);
    border-radius: 12px;
    padding: 10px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
}

.layersbar h3,
.layersbar h4 {
    margin: 8px 0 8px;
    font-size: 14px;
    color: #aad8ff;
}

.layersbar h3,
.layersbar h4 {
    margin: 8px 0 8px;
    font-size: 14px;
    color: #aad8ff;
}

.action-panel {
    margin-top: 10px;
    padding: 10px;
    background: rgba(12, 32, 67, 0.8);
    border: 1px dashed rgba(72, 141, 248, 0.55);
    border-radius: 10px;
}

.action-row {
    margin-top: 8px;
}

.action-btn {
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    background: linear-gradient(
        135deg,
        rgba(73, 143, 255, 0.95),
        rgba(23, 113, 231, 0.9)
    );
    color: #ffffff;
    border: 1px solid rgba(94, 166, 255, 0.9);
    font-weight: 600;
    letter-spacing: 0.4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.action-btn:hover {
    filter: brightness(1.08);
}

/* 坐标定位功能样式 */
.coordinate-navigation {
    margin-top: 20px;
    margin-bottom: 20px;
}

/* .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 15px 0;
    color: var(--grass-12);
} */

.coordinate-input-group {
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.coordinate-input-group .LabelRoot {
    font-size: 16px;
    font-weight: 600;
    color: var(--grass-11);
}

.coordinate-input-group .Input {
    width: 100%;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    padding: 0 10px;
    height: 35px;
    font-size: 16px;
    line-height: 1;
    box-shadow: 0 0 0 1px var(--green-9);
    border: none;
    outline: none;
}

.coordinate-input-group .Input:focus {
    box-shadow: 0 0 0 2px black;
}

.coordinate-input-group .Input::selection {
    background-color: var(--green-9);
    color: white;
}

.coordinate-actions {
    display: flex;
    gap: 10px;
    margin: 15px 0;
}

.fly-btn {
    flex: 1;
    background-color: var(--green-9);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 16px;
    transition: background-color 0.2s;
}

.fly-btn:hover {
    background-color: var(--green-10);
}

.clear-btn {
    flex: 1;
    background-color: var(--grass-6);
    color: var(--grass-12);
    border: 1px solid var(--grass-7);
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 16px;
    transition: background-color 0.2s;
}

.clear-btn:hover {
    background-color: var(--grass-7);
}

.error-message {
    color: #ef4444;
    font-size: 12px;
    margin-top: 10px;
    padding: 8px;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
}

.quick-locations {
    margin-top: 20px;
}

.quick-title {
    font-size: 14px;
    font-weight: 500;
    margin: 0 0 10px 0;
    color: var(--grass-11);
}

.quick-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.quick-btn {
    flex: 1;
    min-width: 60px;
    background-color: var(--grass-4);
    color: var(--grass-12);
    border: 1px solid var(--grass-6);
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.2s;
}

.quick-btn:hover {
    background-color: var(--grass-5);
}
</style>
