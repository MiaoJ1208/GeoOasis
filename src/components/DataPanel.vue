<script setup lang="ts">
import { Icon } from "@iconify/vue";
import Button from "./internals/Button.vue";
</script>

<template>
    <div class="data-panel">
        <h3>功能面板</h3>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-road')">
                <Icon icon="material-symbols:location-on" />
                加载道路数据
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-car-trajectories')">
                <Icon icon="material-symbols:directions-car" />
                轨迹数据映射
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('run-merge')">
                <Icon icon="material-symbols:integration-instructions" />
                融合解析
            </Button>
        </div>
        <div class="action-row">
            <Button class="action-btn" @click="$emit('load-video-vehicle')">
                <Icon icon="material-symbols:videocam" />
                视频数据映射
            </Button>
        </div>
        <div class="action-row">
            <Button
                class="action-btn"
                @click="$emit('toggle-traffic-analysis')"
            >
                <Icon icon="material-symbols:analytics" />
                交通态势预测
            </Button>
        </div>
    </div>
</template>

<style scoped>
.data-panel {
    position: fixed;
    right: 30px;
    top: 100px;
    bottom: 200px;
    width: 200px;
    background: rgba(6, 18, 44, 0.92);
    border: 1px solid rgba(53, 121, 226, 0.9);
    border-radius: 14px;
    padding: 14px;
    box-shadow: 0 0 24px rgba(62, 147, 255, 0.55);
    color: #d9ebff;
    overflow-y: auto;
}

.data-panel h3 {
    margin-bottom: 10px;
    font-size: 15px;
    color: #aad8ff;
}

.action-row {
    margin-top: 10px;
}

.action-btn {
    width: 90%;
    padding: 8px 10px;
    border-radius: 8px;
    background: linear-gradient(
        135deg,
        rgba(73, 143, 255, 0.95),
        rgba(23, 113, 231, 0.9)
    );
    color: #ffffff;
    border: 1px solid rgba(94, 166, 255, 0.9);
    font-weight: 500;
    letter-spacing: 0.4px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.action-btn:hover {
    filter: brightness(1.08);
}
</style>
