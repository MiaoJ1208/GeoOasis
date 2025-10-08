<script setup lang="ts">
import Editor from "./components/Editor.vue";
import AppHeader from "./components/AppHeader.vue";
import FooterBar from "./components/FooterBar.vue";
import LayersBar from "./components/LayersBar.vue";
import InfoPanel from "./components/InfoPanel.vue";
import RoadVisual from "./components/RoadVisual.vue";
import { ref } from "vue";
const roadVisualRef = ref();
function onLoadRoad() {
    roadVisualRef.value?.loadRoadData();
}
</script>

<template>
    <div class="geoasis-app">
        <Editor>
            <AppHeader />
            <LayersBar @load-road="onLoadRoad" />
            <InfoPanel />
            <RoadVisual ref="roadVisualRef" />
            <FooterBar />
        </Editor>
    </div>
</template>

<style scoped>
.geoasis-app {
    height: 100%;
    width: 100%;
}
</style>
