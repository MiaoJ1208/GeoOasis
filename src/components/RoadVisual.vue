<template>
    <div class="road-visualization" v-if="true"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, defineExpose } from "vue";
import * as Cesium from "cesium";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { storeToRefs } from "pinia";
import { parse } from "vue/compiler-sfc";

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
const vehicleEntities: Cesium.Entity[] = [];

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

/**
 * 加载并可视化轨迹数据
 */
async function loadTrajectories(
    trajUrl = "/data/20251030_163823_170604/163823_163848.json",
    assetIndex = 2
) {
    if (editor && editor.viewer) {
        viewer = editor.viewer;
        try {
            const res = await fetch(trajUrl);
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                console.error("轨迹数据格式错误或为空");
                return;
            }
            // 按照palteNo分组并排序
            const groups = new Map<string, Array<any>>();
            for (const item of data) {
                const plate = item.plateNo ?? "未知车辆";
                const lon = parseFloat(item.longitude);
                const lat = parseFloat(item.latitude);
                const alt = parseFloat(item.altitude) || 0;
                let timeMs = NaN;
                if (item.timestamp && item.timeStamp.$numberLong) {
                    timeMs = Number(item.timeStamp.$numberLong);
                } else if (item.time) {
                    const d = new Date(item.time.replace(" ", "T"));
                    if (!isNaN(d.getTime())) {
                        timeMs = d.getTime();
                    }
                }
                if (isNaN(timeMs)) timeMs = Date.now();
                if (!groups.has(plate)) groups.set(plate, []);
                groups.get(plate)!.push({ lon, lat, alt, timeMs });
            }
            for (const arr of groups.values()) {
                arr.sort((a, b) => a.timeMs - b.timeMs);
            }
            if (groups.size === 0) {
                console.warn("No valid points after parse");
                return;
            }

            // 全局时间范围
            let globalStart = Number.POSITIVE_INFINITY;
            let globalStop = 0;
            for (const arr of groups.values()) {
                if (arr.length === 0) continue;
                globalStart = Math.min(globalStart, arr[0].timeMs);
                globalStop = Math.max(globalStop, arr[arr.length - 1].timeMs);
            }
            const startJD = Cesium.JulianDate.fromDate(new Date(globalStart));
            const stopJD = Cesium.JulianDate.fromDate(new Date(globalStop));

            // 获取模型 URL（支持 IonResource 或 string）
            const assetId =
                editor.assetLibrary.getAssetId(assetIndex) ?? "asset-4";
            const modelUrl = await editor.assetLibrary.getAssetUrl(assetId);

            // 为每辆车创建实体
            for (const [plate, pts] of groups) {
                if (pts.length === 0) continue;
                const sampled = new Cesium.SampledPositionProperty();
                for (const p of pts) {
                    const jd = Cesium.JulianDate.fromDate(new Date(p.timeMs));
                    const cart = Cesium.Cartesian3.fromDegrees(
                        p.lon,
                        p.lat,
                        p.alt
                    );
                    sampled.addSample(jd, cart);
                }

                // 创建用于朝向的 VelocityOrientationProperty（可复用）
                const velOri = new Cesium.VelocityOrientationProperty(sampled);
                // 需要旋转的固定四元数：这里绕 Z 轴 90 度，若方向不对可改为 -90 或换轴（UNIT_X/UNIT_Y）
                const fixQuat = Cesium.Quaternion.fromAxisAngle(
                    Cesium.Cartesian3.UNIT_Z,
                    Cesium.Math.toRadians(-90)
                );

                const ent = viewer.entities.add({
                    id: `veh-${plate}-${Math.random().toString(36).slice(2, 8)}`,
                    name: plate,
                    availability: new Cesium.TimeIntervalCollection([
                        new Cesium.TimeInterval({
                            start: startJD,
                            stop: stopJD
                        })
                    ]),
                    position: sampled,
                    // orientation: new Cesium.VelocityOrientationProperty(
                    //     sampled
                    // ),
                    orientation: new Cesium.CallbackProperty(
                        (
                            time?: Cesium.JulianDate,
                            result?: Cesium.Quaternion
                        ) => {
                            if (!time) return undefined;
                            const q = velOri.getValue(time);
                            if (!q) return undefined;
                            // result = q * fixQuat
                            return Cesium.Quaternion.multiply(
                                q,
                                fixQuat,
                                result || new Cesium.Quaternion()
                            );
                        },
                        false
                    ),
                    model: {
                        // Cesium 接受 IonResource 或 string
                        uri:
                            (modelUrl as any) ??
                            "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
                        minimumPixelSize: 48,
                        maximumScale: 20
                    },
                    path: {
                        show: true,
                        leadTime: 0,
                        trailTime: Math.max(
                            10,
                            (globalStop - globalStart) / 1000
                        ),
                        width: 3,
                        material: Cesium.Color.YELLOW
                    },
                    label: {
                        text: plate,
                        font: "12px sans-serif",
                        fillColor: Cesium.Color.WHITE,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        outlineWidth: 2,
                        pixelOffset: new Cesium.Cartesian2(0, -30)
                    }
                });

                vehicleEntities.push(ent);
            }

            // 设置时钟并播放、缩放到第一辆车
            viewer.clock.startTime = startJD;
            viewer.clock.stopTime = stopJD;
            viewer.clock.currentTime = startJD;
            viewer.clock.multiplier = 1;
            viewer.clock.shouldAnimate = true;

            if (vehicleEntities.length > 0) {
                viewer.trackedEntity = vehicleEntities[0];
                await viewer.flyTo(vehicleEntities[0], { duration: 1.5 });
                console.log(
                    "Trajectories loaded, entities:",
                    vehicleEntities.length
                );
            }
            return vehicleEntities;
        } catch (err) {
            console.error("加载轨迹数据失败:", err);
        }
    }
}

defineExpose({ loadRoadData, loadTrajectories });
</script>

<style scoped></style>
