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
        <h2>坐标定位</h2>
        <div class="coordinate-input-row">
            <div class="coordinate-input-group">
                <Label class="LabelRoot" for="longitude">经度</Label>
                <input
                    id="longitude"
                    class="Input"
                    type="number"
                    inputmode="decimal"
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
                    inputmode="decimal"
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
                    inputmode="decimal"
                    step="any"
                    v-model="height"
                    placeholder="628"
                    @keyup.enter="flyToCoordinates"
                />
            </div>
        </div>

        <div class="coordinate-actions">
            <button class="fly-btn" @click="flyToCoordinates">
                <Icon icon="material-symbols:location-on-outline" />
                定位
            </button>
            <button class="clear-btn" @click="clearInputs">
                <Icon icon="material-symbols:close" />
                清空
            </button>
        </div>

        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </div>
</template>

<style scoped>
.flyto-panel {
    position: fixed;
    z-index: var(--ui-z-panel);
    right: 14px;
    bottom: 14px;
    width: 350px;
    padding: 14px;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
    color: var(--ui-text-secondary);
}

.flyto-panel h2 {
    margin: 0 0 10px;
    color: var(--ui-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.coordinate-input-row {
    display: flex;
    gap: 8px;
}

.coordinate-input-group {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
}

.LabelRoot {
    color: var(--ui-text-muted);
    font-size: 12px;
    font-weight: 500;
}

.Input {
    width: 100%;
    height: 40px;
    min-width: 0;
    padding: 0 9px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: rgba(2, 6, 23, 0.52);
    color: var(--ui-text);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 12px;
    outline: none;
    transition:
        border-color var(--ui-transition),
        box-shadow var(--ui-transition);
}

.Input:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px var(--ui-accent-soft);
}

.coordinate-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}

.fly-btn,
.clear-btn {
    flex: 1;
    min-height: 42px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    padding: 0 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
}

.fly-btn {
    background: var(--ui-accent-strong);
    color: #fff;
}

.clear-btn {
    border-color: var(--ui-border);
    background: rgba(30, 41, 59, 0.78);
    color: var(--ui-text-secondary);
}

.fly-btn:hover,
.clear-btn:hover {
    filter: brightness(1.12);
}

.error-message {
    margin-top: 10px;
    padding: 8px 10px;
    border: 1px solid rgba(248, 113, 113, 0.38);
    border-radius: var(--ui-radius-sm);
    background: rgba(248, 113, 113, 0.12);
    color: #fecaca;
    font-size: 12px;
}

@media (max-width: 920px) {
    .flyto-panel {
        right: 8px;
        bottom: 8px;
        width: 300px;
    }

    .fly-btn,
    .clear-btn {
        min-height: 44px;
    }

    .Input {
        height: 44px;
    }
}

@media (max-width: 620px) {
    .flyto-panel {
        right: 8px;
        left: 8px;
        width: auto;
    }
}
</style>
