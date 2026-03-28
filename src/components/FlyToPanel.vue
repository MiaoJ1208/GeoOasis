<script setup lang="ts">
import { Label } from "radix-vue";
import { Icon } from "@iconify/vue";
import { useCoordinateNavigation } from "../composables/useCoordinateNavigation";

const {
    longitude,
    latitude,
    height,
    errorMessage,
    flyToCoordinates,
    clearInputs
} = useCoordinateNavigation();
</script>

<template>
    <div class="flyto-panel">
        <h4>坐标定位</h4>
        <div class="coordinate-input-row">
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="longitude">经度</Label>
                <input
                    id="longitude"
                    class="Input"
                    type="number"
                    step="any"
                    v-model="longitude"
                    placeholder="117.48463609349766"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="latitude">纬度</Label>
                <input
                    id="latitude"
                    class="Input"
                    type="number"
                    step="any"
                    v-model="latitude"
                    placeholder="40.44651364265419"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="height">高度（米）</Label>
                <input
                    id="height"
                    class="Input"
                    type="number"
                    step="any"
                    v-model="height"
                    placeholder="628"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
        </div>

        <div class="coordinate-actions">
            <button class="fly-btn" @click="flyToCoordinates">
                <Icon icon="material-symbols:location-on" />
                定位
            </button>
            <button class="clear-btn" @click="clearInputs">
                <Icon icon="material-symbols:clear" />
                清空
            </button>
        </div>

        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </div>
</template>

<style scoped>
.flyto-panel {
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: min(320px, 90vw);
    background: rgba(13, 29, 72, 0.95);
    border: 1px solid rgba(50, 130, 255, 0.6);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 0 20px rgba(30, 144, 255, 0.35);
    z-index: 999;
    color: #e2f1ff;
}

.flyto-panel h4 {
    margin: 0 0 8px;
    color: #b8d8ff;
    font-size: 14px;
    font-weight: 700;
}

.coordinate-input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
}

.coordinate-input-group {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 60px;
    max-width: 90px;
}

@media (max-width: 500px) {
    .coordinate-input-group {
        min-width: 100%;
        max-width: 100%;
    }
}

.LabelRoot {
    color: #9cc8ff;
    font-size: 12px;
}

.Input {
    width: 100%;
    border: 1px solid rgba(91, 135, 255, 0.45);
    border-radius: 6px;
    background: rgba(5, 21, 54, 0.8);
    color: #f0f9ff;
    padding: 6px 8px;
    outline: none;
}

.Input:focus {
    border-color: #58a6ff;
    box-shadow: 0 0 0 2px rgba(63, 143, 255, 0.3);
}

.coordinate-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.fly-btn,
.clear-btn {
    flex: 1;
    border: none;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
}

.fly-btn {
    background: linear-gradient(135deg, #1781ff, #44a1ff);
    color: #fff;
}

.clear-btn {
    background: rgba(80, 90, 120, 0.7);
    color: #d7e5ff;
    border: 1px solid rgba(90, 115, 160, 0.7);
}

.fly-btn:hover,
.clear-btn:hover {
    filter: brightness(1.08);
}

.error-message {
    margin-top: 10px;
    background: rgba(255, 75, 75, 0.15);
    color: #ffb9b9;
    border: 1px solid rgba(255, 84, 84, 0.46);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 11px;
}
</style>
