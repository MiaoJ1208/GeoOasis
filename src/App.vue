<script setup lang="ts">
import Editor from "./components/Editor.vue";
import AppHeader from "./components/AppHeader.vue";
import FooterBar from "./components/FooterBar.vue";
import LayersBar from "./components/LayersBar.vue";
import DataPanel from "./components/DataPanel.vue";
import FlyToPanel from "./components/FlyToPanel.vue";
import InfoPanel from "./components/InfoPanel.vue";
import RoadVisual from "./components/RoadVisual.vue";
import { useGeoOasisStore } from "./store/GeoOasis.store";
import { ElMessage } from "element-plus";
import { onMounted, watch } from "vue";
import { ref } from "vue";
const roadVisualRef = ref();
const store = useGeoOasisStore();
function onLoadRoad() {
    roadVisualRef.value?.loadRoadData();
}
function handleLoadRoad() {
    roadVisualRef.value?.loadTrajectories(
        "/data/20251030_163823_170604/Simulatedtrajectory1.json",
        2
    );
}
function videoVehicle() {
    roadVisualRef.value?.videoVehicle();
}

async function runMerge() {
    try {
        const res = await fetch("/run-merge", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        roadVisualRef.value?.connectVehicleSocket?.();

        if (!res.ok) {
            const errorData = await res
                .json()
                .catch(() => ({ message: res.statusText }));
            throw new Error(errorData.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log("run-merge response:", data);

        if (data.success) {
            ElMessage.success(data.message || "融合解析已启动");
        } else {
            ElMessage.error(data.message || data.error || "融合解析执行失败");
        }
    } catch (err: any) {
        console.error("run-merge error:", err);
        ElMessage.error(
            err.message || "触发失败，请确认后端服务已启动（运行 pnpm run-bat-server）"
        );
    }
}

function toggleTrafficAnalysis() {
    store.isTrafficAnalysis = !store.isTrafficAnalysis;
}
</script>

<template>
    <div class="geoasis-app">
        <div class="global-title">公路交通数字孪生智能平台</div>
        <Editor>
            <AppHeader />
            <LayersBar
                @load-road="onLoadRoad"
                @load-car-trajectories="handleLoadRoad"
                @load-video-vehicle="videoVehicle"
            />
            <DataPanel
                @load-road="onLoadRoad"
                @load-car-trajectories="handleLoadRoad"
                @run-merge="runMerge"
                @load-video-vehicle="videoVehicle"
                @toggle-traffic-analysis="toggleTrafficAnalysis"
            />
            <InfoPanel />
            <RoadVisual ref="roadVisualRef" />
            <FlyToPanel />
            <FooterBar />
        </Editor>
    </div>
</template>

<style scoped>
.geoasis-app {
    height: 100%;
    width: 100%;
}

.global-title {
    position: fixed;
    top: 30px;
    left: 30%;
    transform: translateX(-50%);
    z-index: 1001;
    font-size: 26px;
    font-weight: 900;
    color: #cce8ff;
    letter-spacing: 1px;
    padding: 4px 14px;
    border-radius: 10px;
    background: rgba(5, 22, 52, 0.9);
    border: 1px solid rgba(72, 148, 255, 0.8);
    box-shadow: 0 0 18px rgba(50, 142, 255, 0.35);
}
</style>
