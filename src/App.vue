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
import { ref } from "vue";
const roadVisualRef = ref();
const store = useGeoOasisStore();
function onLoadRoad() {
    roadVisualRef.value?.loadRoadData();
}
function handleLoadRoad() {
    roadVisualRef.value?.toggleK37Trajectories();
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
            err.message ||
                "触发失败，请确认后端服务已启动（运行 pnpm run-bat-server）"
        );
    }
}

function toggleTrafficAnalysis() {
    store.isTrafficAnalysis = !store.isTrafficAnalysis;
}
function toggleRealtimeTraffic() {
    roadVisualRef.value?.toggleRealtimeTraffic();
}
</script>

<template>
    <div class="geoasis-app">
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
                @toggle-realtime-traffic="toggleRealtimeTraffic"
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
    --el-color-primary: var(--ui-accent);
    --el-bg-color-overlay: var(--ui-surface-strong);
    --el-text-color-primary: var(--ui-text);
    --el-text-color-regular: var(--ui-text-secondary);
    --el-border-color: var(--ui-border);
}
</style>
