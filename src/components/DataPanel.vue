<script setup lang="ts">
import { Icon } from "@iconify/vue";
import Button from "./internals/Button.vue";
</script>

<template>
    <aside class="data-panel" aria-label="交通分析功能">
        <h2>功能面板</h2>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-road')">
                <Icon icon="material-symbols:location-on-outline" />
                加载道路数据
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-car-trajectories')">
                <Icon icon="material-symbols:directions-car-outline" />
                轨迹数据映射
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('run-merge')">
                <Icon
                    icon="material-symbols:integration-instructions-outline"
                />
                融合解析
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-video-vehicle')">
                <Icon icon="material-symbols:videocam-outline" />
                视频数据映射
            </Button>
        </div>
        <div class="action-row">
            <Button
                class="action-btn"
                @click="$emit('toggle-traffic-analysis')"
            >
                <Icon icon="material-symbols:analytics-outline" />
                交通态势预测
            </Button>
        </div>
        <div class="action-row">
            <Button
                class="action-btn"
                @click="$emit('toggle-realtime-traffic')"
            >
                <Icon icon="material-symbols:traffic" />
                实时交通模拟
            </Button>
        </div>
    </aside>
</template>

<style scoped>
.data-panel {
    position: fixed;
    z-index: var(--ui-z-panel);
    top: 82px;
    right: 14px;
    bottom: 218px;
    width: 244px;
    overflow-y: auto;
    padding: 14px;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
    color: var(--ui-text-secondary);
}

.data-panel h2 {
    margin: 0 0 12px;
    color: var(--ui-text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.action-row {
    margin-top: 8px;
}

.action-btn {
    width: 100%;
    min-height: 44px;
    justify-content: flex-start;
    padding: 0 12px;
    border-color: var(--ui-border);
    background: rgba(30, 41, 59, 0.68);
    color: var(--ui-text-secondary);
    font-weight: 600;
    letter-spacing: 0.01em;
}

.action-btn :deep(svg) {
    flex: 0 0 auto;
    color: #93c5fd;
    font-size: 18px;
}

.action-btn:hover {
    border-color: var(--ui-border-strong);
    background: var(--ui-accent-soft);
    color: var(--ui-text);
}

@media (max-width: 920px) {
    .data-panel {
        top: 70px;
        right: 8px;
        bottom: 208px;
        width: 210px;
    }
}

@media (max-width: 620px) {
    .data-panel {
        bottom: auto;
        width: calc(50vw - 12px);
        max-height: 42vh;
    }
}

@media (max-height: 640px) and (min-width: 621px) {
    .data-panel {
        bottom: 14px;
    }
}
</style>
