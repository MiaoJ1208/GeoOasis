<script setup lang="ts">
import { Label } from "radix-vue";
import { Icon } from "@iconify/vue";
import Separator from "./internals/Separator.vue";
import Select from "./internals/Select.vue";
import LayerBarItem from "./LayerBarItem.vue";
import Button from "./internals/Button.vue";
import { useLayersBar } from "../composables/useLayersBar";
import { useCoordinateNavigation } from "../composables/useCoordinateNavigation";
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

const {
    longitude,
    latitude,
    height,
    errorMessage,
    flyToCoordinates,
    clearInputs
} = useCoordinateNavigation();

// 新增：触发后端执行 bat 的请求（项目开发时可用代理 /run-merge）
async function runMerge() {
    try {
        const res = await fetch("/run-merge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            const errorData = await res
                .json()
                .catch(() => ({ message: res.statusText }));
            throw new Error(errorData.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log("run-merge response:", data);

        if (data.success) {
            alert(`融合解析执行成功！\n${data.message || ""}`);
        } else {
            alert(
                `融合解析执行失败：\n${data.message || data.error || "未知错误"}`
            );
        }
    } catch (err: any) {
        console.error("run-merge error:", err);
        alert(
            `触发失败：${err.message || "请确认后端服务已启动（运行 pnpm run-bat-server）"}`
        );
    }
}
</script>

<template>
    <div class="layersbar">
        <!-- 影像图层 -->
        <h3>Imagery Layers</h3>
        <Label>BaseLayer:</Label>
        <Select
            title="BaseMap"
            :selected="selectedBaseLayer"
            :select-options="baseMapOptions"
            @update:model-value="selectedBaseLayer = $event"
        ></Select>
        <Separator />
        <Label>Terrain:</Label>
        <Select
            title="Terrain"
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
        <h3>Other Layers</h3>
        <LayerBarItem
            type="layer"
            v-for="e in layersArray"
            :key="e.get('id')"
            :item="e"
            @handle-select="handleSelect"
            @handle-delete="handleDelete"
        />
        <Separator />
        <h3>Elements</h3>
        <LayerBarItem
            type="element"
            v-for="e in elementArray"
            :key="e.get('id') as string"
            :item="e"
            @handle-select="handleSelect"
            @handle-delete="handleDelete"
        />
        <Separator />
        <div>
            <Button @click="$emit('load-road')">
                <Icon icon="material-symbols:location-on" />
                加载道路数据
            </Button>
        </div>
        <Separator />
        <div>
            <Button @click="$emit('load-car-trajectories')">
                <Icon icon="material-symbols:location-on" />
                轨迹数据映射
            </Button>
        </div>
        <Separator />
        <div>
            <Button @click="runMerge">
                <Icon icon="material-symbols:integration-instructions" />
                融合解析
            </Button>
        </div>
        <Separator />
        <div>
            <Button @click="$emit('load-video-vehicle')">
                <Icon icon="material-symbols:integration-instructions" />
                视频数据映射
            </Button>
        </div>
        <Separator />
        <div class="coordinate-navigation">
            <h3 class="section-title">坐标定位</h3>
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="longitude">经度:</Label>
                <input
                    id="longitude"
                    class="Input"
                    type="number"
                    step="any"
                    placeholder="117.353878"
                    v-model="longitude"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="latitude">纬度:</Label>
                <input
                    id="latitude"
                    class="Input"
                    type="number"
                    step="any"
                    placeholder="40.261073"
                    v-model="latitude"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="height">高度(米):</Label>
                <input
                    id="height"
                    class="Input"
                    type="number"
                    step="any"
                    placeholder="例如: 1000"
                    v-model="height"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
            <div class="coordinate-actions">
                <Button @click="flyToCoordinates" class="fly-btn">
                    <Icon icon="material-symbols:location-on" />
                    定位
                </Button>
                <Button @click="clearInputs" class="clear-btn">
                    <Icon icon="material-symbols:clear" />
                    清空
                </Button>
            </div>
            <div v-if="errorMessage" class="error-message">
                {{ errorMessage }}
            </div>
        </div>

        <Separator />
    </div>
</template>

<style scoped>
.layersbar {
    position: fixed;
    left: 30px;
    top: 100px;
    bottom: 50px;

    width: 250px;
    /* height: calc(100% - 300px); */
    overflow-y: auto;

    background-color: var(--grass-1);
    box-shadow: 0 0 10px;
    border-radius: 10px;
    padding: 15px;
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
