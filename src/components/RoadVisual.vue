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

// 计算路网的边界
const calculateBounds = (features: RoadFeature[]) => {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    features.forEach((feature) => {
        feature.geometry.coordinates.forEach((coord) => {
            minLng = Math.min(minLng, coord[0]);
            maxLng = Math.max(maxLng, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLat = Math.max(maxLat, coord[1]);
        });
    });

    return {
        minLng,
        maxLng,
        minLat,
        maxLat
    };
};

// // 定位到路网
// const flyToRoadNetwork = (features: RoadFeature[]) => {
//     if (!viewer) {
//         console.error("Viewer is not initialized");
//         return;
//     }

//     const bounds = calculateBounds(features);
//     const centerLng = (bounds.minLng + bounds.maxLng) / 2;
//     const centerLat = (bounds.minLat + bounds.maxLat) / 2;

//     // 计算合适的缩放级别
//     const lngDiff = bounds.maxLng - bounds.minLng;
//     const latDiff = bounds.maxLat - bounds.minLat;
//     const maxDiff = Math.max(lngDiff, latDiff);
//     const zoomLevel = Math.log2(360 / maxDiff) - 1;

//     viewer.camera.flyTo({
//         destination: Cesium.Cartesian3.fromDegrees(
//             centerLng,
//             centerLat,
//             zoomLevel * 10000
//         ),
//         orientation: {
//             heading: Cesium.Math.toRadians(0),
//             pitch: Cesium.Math.toRadians(-60),
//             roll: 0.0
//         },
//         duration: 2
//     });
// };

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
                const positions = coordinates.map((coord) =>
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

onMounted(async () => {
    viewer = editor?.viewer || null;
    if (!viewer) {
        console.error("Cesium Viewer is not available");
        return;
    }

    // GeoJSON文件URL
    const geoJsonUrl = "./data/roadCity.json";
    await loadGeoJSON(geoJsonUrl);
});
</script>

<style scoped></style>
