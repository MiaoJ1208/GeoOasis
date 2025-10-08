<template>
    <div class="road-visualization" v-if="true"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { storeToRefs } from "pinia";

interface RoadFeature {
    type: string;
    geometry: {
        type: string;
        coordinates: number[][];
    };
}

const store = useGeoOasisStore();
const { editor } = store;
let viewer: Cesium.Viewer | null = null;
const roadEntities: Cesium.Entity[] = [];

// 加载GeoJSON数据
const loadGeoJSON = async (url: string) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // 创建路段实体
        data.geometries.forEach((geometry: any) => {
            if (geometry.type === "LineString") {
                const coordinates = geometry.coordinates;
                const positions = coordinates.map((coord: any) =>
                    Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0)
                );
                const entity = viewer?.entities.add({
                    polyline: {
                        positions: positions,
                        width: 4,
                        material:
                            Cesium.Color.fromCssColorString(
                                "#1E40AF"
                            ).withAlpha(0.7),
                        clampToGround: true,
                        zIndex: 100
                    }
                });

                if (entity) {
                    roadEntities.push(entity);
                }
            }
        });

        viewer?.flyTo(roadEntities[0]);
    } catch (error) {
        console.error("Error loading GeoJSON:", error);
    }
};

function loadRoadData() {
    if (editor && editor.viewer) {
        viewer = editor.viewer;
        // GeoJSON文件URL
        const geoJsonUrl = "./data/roadCity.json";
        loadGeoJSON(geoJsonUrl);
    } else {
        console.error("Editor or Viewer is not available");
    }
}

defineExpose({ loadRoadData });
</script>

<style scoped></style>
