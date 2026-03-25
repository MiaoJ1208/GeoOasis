<template>
    <div class="road-visualization" v-if="true"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { storeToRefs } from "pinia";
import { parse } from "vue/compiler-sfc";
import { Cartesian3 } from "cesium";
import { createTunnelClippingPlanes } from "../editor/tunnelClipping";

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

/**
 * 加载并可视化轨迹数据
 */
const vehicleEntities: Cesium.Entity[] = [];
async function loadTrajectories(
    trajUrl = "/data/20251030_163823_170604/Simulatedtrajectory1.json",
    assetIndex = 2
) {
    if (editor && editor.viewer) {
        viewer = editor.viewer;
        try {
            const res = await fetch(`${trajUrl}?t=${Date.now()}`);
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
                if (item.timeStamp && item.timeStamp.$numberLong) {
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
                // // 需要旋转的固定四元数：这里绕 Z 轴 90 度，若方向不对可改为 -90 或换轴（UNIT_X/UNIT_Y）
                const fixQuat = Cesium.Quaternion.fromAxisAngle(
                    Cesium.Cartesian3.UNIT_Z,
                    Cesium.Math.toRadians(-90)
                );

                // LOD 阈值（可根据需要调整）
                const modelDistanceThreshold = 1500; // 距离小于此值显示模型（米）
                const pointDistanceThreshold = modelDistanceThreshold; // >= 显示点/图标

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
                const target = vehicleEntities[5];
                // ❗ 禁用 trackedEntity
                // viewer.trackedEntity = undefined;
                // viewer.clock.onTick.addEventListener(() => {
                //     const time = viewer.clock.currentTime;
                //     const position = target.position?.getValue(time);
                //     const orientation = target.orientation?.getValue(time);
                //     if (!position || !orientation) return;
                //     // 1️⃣ 从四元数得到 heading（绕 Z 轴的朝向）
                //     const hpr =
                //         Cesium.HeadingPitchRoll.fromQuaternion(orientation);
                //     // ⚠️ glTF 通常前向是 -Z，所以需要修正 180° 或 90°
                //     const heading = hpr.heading + Cesium.Math.PI; // 车尾方向
                //     const pitch = Cesium.Math.toRadians(-15); // 稍微俯视
                //     const range = 10; // 距离车 40 米
                // 2️⃣ 核心：相机锁定在车辆局部坐标系
                // viewer.camera.lookAt(
                //     position,
                //     new Cesium.HeadingPitchRange(heading, pitch, range)
                // );
                // });
            }
            return vehicleEntities;
        } catch (err) {
            console.error("加载轨迹数据失败:", err);
        }
    }
}

/**
 * 实时轨迹映射
 */
// const vehicleMap = new Map<
//     string,
//     {
//         entity: Cesium.Entity;
//         sampled: Cesium.SampledPositionProperty;
//     }
// >();

// const vehicleEntities: Cesium.Entity[] = [];

// function createVehicleEntity(
//     viewer: Cesium.Viewer,
//     plate: string,
//     modelUrl: string
// ) {
//     // 查找已有车辆实体
//     let vehicle = vehicleMap.get(plate);

//     // 如果车辆实体已存在，直接返回已有实体
//     if (vehicle) {
//         return vehicle;
//     }
//     const sampled = new Cesium.SampledPositionProperty();

//     // ⭐⭐⭐ 关键 1：允许外推（实时必须）
//     sampled.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
//     sampled.forwardExtrapolationDuration = 60; // 秒

//     const velOri = new Cesium.VelocityOrientationProperty(sampled);
//     const fixQuat = Cesium.Quaternion.fromAxisAngle(
//         Cesium.Cartesian3.UNIT_Z,
//         Cesium.Math.toRadians(-90)
//     );

//     const entity = viewer.entities.add({
//         id: `veh-${plate}`,
//         name: plate,
//         // ⭐⭐⭐ 关键 2：availability 给无限时间
//         availability: new Cesium.TimeIntervalCollection([
//             new Cesium.TimeInterval({
//                 start: Cesium.JulianDate.fromIso8601("2000-01-01"),
//                 stop: Cesium.JulianDate.fromIso8601("2100-01-01")
//             })
//         ]),
//         position: sampled,
//         // orientation: new Cesium.VelocityOrientationProperty(sampled),
//         orientation: new Cesium.CallbackProperty(
//             (time?: Cesium.JulianDate, result?: Cesium.Quaternion) => {
//                 if (!time) return undefined;
//                 const q = velOri.getValue(time);
//                 if (!q) return undefined;
//                 // result = q * fixQuat
//                 return Cesium.Quaternion.multiply(
//                     q,
//                     fixQuat,
//                     result || new Cesium.Quaternion()
//                 );
//             },
//             false
//         ),
//         model: {
//             uri: modelUrl,
//             minimumPixelSize: 48,
//             maximumScale: 20
//         },
//         path: {
//             show: true,
//             trailTime: 30,
//             width: 3,
//             material: Cesium.Color.YELLOW
//         },
//         label: {
//             text: plate,
//             font: "12px sans-serif",
//             fillColor: Cesium.Color.WHITE,
//             pixelOffset: new Cesium.Cartesian2(0, -30)
//         }
//     });

//     vehicleMap.set(plate, { entity, sampled });
//     vehicleEntities.push(entity);

//     return vehicleMap.get(plate)!;
// }

// function onRealtimePoint(viewer: Cesium.Viewer, item: any, modelUrl: string) {
//     const plate = item.plateNo ?? "未知车辆";

//     const lon = Number(item.longitude);
//     const lat = Number(item.latitude);
//     const alt = Number(item.altitude) || 0;

//     const jd = item.timeStamp?.$numberLong
//         ? Cesium.JulianDate.fromDate(
//               new Date(Number(item.timeStamp.$numberLong))
//           )
//         : Cesium.JulianDate.now();

//     let vehicle = vehicleMap.get(plate);
//     if (!vehicle) {
//         vehicle = createVehicleEntity(viewer, plate, modelUrl);
//     }

//     vehicle.sampled.addSample(jd, Cesium.Cartesian3.fromDegrees(lon, lat, alt));
// }

// 模拟实时推送
// async function simulateRealtimePush(
//     viewer: Cesium.Viewer,
//     data: any[],
//     modelUrl: string
// ) {
//     for (let i = 0; i < data.length; i++) {
//         const item = data[i];

//         const jd = Cesium.JulianDate.fromDate(
//             new Date(Number(item.timeStamp.$numberLong))
//         );

//         // ⭐ 同步 clock
//         viewer.clock.currentTime = jd;

//         onRealtimePoint(viewer, item, modelUrl);

//         if (i < data.length - 1) {
//             const dt =
//                 Number(data[i + 1].timeStamp.$numberLong) -
//                 Number(item.timeStamp.$numberLong);

//             await new Promise((r) => setTimeout(r, Math.max(50, dt)));
//         }
//     }
// }

// let ws1: WebSocket | null = null;

// function connectRealtimeWS(viewer: Cesium.Viewer, modelUrl: string) {
//     ws1 = new WebSocket("ws://localhost:8081");

//     ws1.onopen = () => {
//         console.log("[WS] connected");
//     };

//     ws1.onmessage = (evt) => {
//         const item = JSON.parse(evt.data);

//         // ⭐ 每来一条，就更新一次
//         onRealtimePoint(viewer, item, modelUrl);

//         // ⭐ 同步 Cesium 时钟（关键）
//         if (item.timeStamp?.$numberLong) {
//             viewer.clock.currentTime = Cesium.JulianDate.fromDate(
//                 new Date(Number(item.timeStamp.$numberLong))
//             );
//         }
//     };

//     ws1.onclose = () => {
//         console.log("[WS] closed");
//     };

//     ws1.onerror = (err) => {
//         console.error("[WS] error", err);
//     };
// }

// async function loadTrajectories(
//     trajUrl = "/data/20251030_163823_170604/Simulatedtrajectory1.json",
//     assetIndex = 2
// ) {
//     async function loadTrajectories(trajUrl = "", assetIndex = 2) {
//         if (!editor || !editor.viewer) return;
//         viewer = editor.viewer;

//         const modelUrl = "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf";

//         // Clock 初始化（只做一次）
//         const start = Cesium.JulianDate.now();
//         viewer.clock.startTime = start.clone();
//         viewer.clock.currentTime = start.clone();
//         viewer.clock.shouldAnimate = true;
//         viewer.clock.multiplier = 1;
//         viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

//         // ⭐ 启动 WebSocket
//         connectRealtimeWS(viewer, modelUrl);
//     }
// }

/**
 * 视频车辆实时映射
 *
 */
type LaneConfig = {
    start: Cesium.Cartesian3;
    end: Cesium.Cartesian3;
    modelUri?: string;
    minimumPixelSize?: number;
};

const ROAD_LANES: Record<string, LaneConfig> = {
    // 例子：你可以把不同视频/路段映射到不同的经纬度“车道”
    road_1: {
        start: Cesium.Cartesian3.fromDegrees(117.48339, 40.445983, 587.21),
        end: Cesium.Cartesian3.fromDegrees(117.481602, 40.443692, 591.05),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    },

    // 例子：第二路视频/路段（请换成你的真实坐标）
    road_2: {
        start: Cesium.Cartesian3.fromDegrees(117.481602, 40.443692, 591.05),
        end: Cesium.Cartesian3.fromDegrees(117.478541, 40.439751, 597.61),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    },

    road_3: {
        start: Cesium.Cartesian3.fromDegrees(117.482972, 40.4463174, 588.81),
        end: Cesium.Cartesian3.fromDegrees(117.48119, 40.444024, 592.62),
        modelUri: "/truckModel.glb",
        minimumPixelSize: 40
    },

    // 单路/未设置时的兜底
    default: {
        start: Cesium.Cartesian3.fromDegrees(117.48339, 40.445983, 587.21),
        end: Cesium.Cartesian3.fromDegrees(117.481602, 40.443692, 591.05),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    }
};

function spawnRealtimeVehicle(
    videoId: string,
    type: string = "car",
    lifeSeconds = 45
) {
    if (editor && editor.viewer) {
        viewer = editor.viewer;

        // ===== 1. 定义一条“虚拟车道”（和你道路对齐即可）=====
        // Cesium.Cartesian3.fromDegrees, 把 WGS84 经纬度坐标 转换为 Cesium 世界坐标（ECEF）
        const lane = ROAD_LANES[videoId] ?? ROAD_LANES.default;
        const start = lane.start;
        const end = lane.end;

        //cesium时间系统，儒略时间，lifeseconds秒后消失
        const now = Cesium.JulianDate.now();
        const stop = Cesium.JulianDate.addSeconds(
            now,
            lifeSeconds,
            new Cesium.JulianDate()
        );

        if (
            !viewer.clock.startTime ||
            Cesium.JulianDate.lessThan(now, viewer.clock.startTime)
        ) {
            viewer.clock.startTime = Cesium.JulianDate.addSeconds(
                now,
                -1,
                new Cesium.JulianDate()
            );
        }

        //SampledPositionProperty,是cesiumJS中的属性类型，表示物体在空间中随时间变化的位置。
        // 基于采样点的位置数据，通过插值计算可以获取任意时间点上的位置信息
        const sampled = new Cesium.SampledPositionProperty();
        //添加一个 时间-位置 对样本。getValue(time, result)：根据给定时间获取插值后的属性值。
        sampled.addSample(now, start);
        sampled.addSample(stop, end);

        const velOri = new Cesium.VelocityOrientationProperty(sampled);
        const fixQuat = Cesium.Quaternion.fromAxisAngle(
            Cesium.Cartesian3.UNIT_Z,
            Cesium.Math.toRadians(-90)
        );

        viewer.clock.startTime = now.clone();
        viewer.clock.currentTime = now.clone();
        viewer.clock.stopTime = stop.clone();
        viewer.clock.shouldAnimate = true;

        let entity;

        if (type === "car") {
            entity = viewer.entities.add({
                availability: new Cesium.TimeIntervalCollection([
                    new Cesium.TimeInterval({ start: now, stop })
                ]),
                position: sampled,
                orientation: new Cesium.CallbackProperty(
                    (time?: Cesium.JulianDate, result?: Cesium.Quaternion) => {
                        if (!time) return undefined;
                        const q = velOri.getValue(time);
                        if (!q) return undefined;
                        // 对car应用旋转修正
                        return Cesium.Quaternion.multiply(
                            q,
                            fixQuat,
                            result || new Cesium.Quaternion()
                        );
                    },
                    false
                ),
                model: {
                    uri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
                    minimumPixelSize: 40
                }
            });
        } else if (type === "truck") {
            entity = viewer.entities.add({
                availability: new Cesium.TimeIntervalCollection([
                    new Cesium.TimeInterval({ start: now, stop })
                ]),
                position: sampled,
                // truck直接使用原始方向，不需要旋转修正
                orientation: velOri,
                model: {
                    uri: "/truckModel.glb",
                    minimumPixelSize: 40
                }
            });
        } else {
            console.error(`[RoadVisual] Unknown vehicle type: ${type}`);
            return;
        }

        if (entity) {
            vehicleEntities.push(entity);
            console.log(
                `[RoadVisual] Spawned realtime vehicle of type ${type}, will live for ${lifeSeconds} seconds`
            );
            console.log(
                `[RoadVisual] Clock: start=${viewer.clock.startTime}, current=${viewer.clock.currentTime}, stop=${viewer.clock.stopTime}`
            );
        }
    }
}

// function spawnRealtimeVehicle(type: string = "car", lifeSeconds = 60) {
//     if (editor && editor.viewer) {
//         viewer = editor.viewer;

//         // ===== 1. 定义一条“虚拟车道”（和你道路对齐即可）=====
//         // Cesium.Cartesian3.fromDegrees, 把 WGS84 经纬度坐标 转换为 Cesium 世界坐标（ECEF）
//         const start = Cesium.Cartesian3.fromDegrees(
//             117.48339,
//             40.445983,
//             587.21
//         );
//         const end = Cesium.Cartesian3.fromDegrees(
//             117.481602,
//             40.443692,
//             591.05
//         );
//         //116.391, 39.9, 100   39.902

//         //cesium时间系统，儒略时间，lifeseconds秒后消失
//         const now = Cesium.JulianDate.now();
//         const stop = Cesium.JulianDate.addSeconds(
//             now,
//             lifeSeconds,
//             new Cesium.JulianDate()
//         );

//         //SampledPositionProperty,是cesiumJS中的属性类型，表示物体在空间中随时间变化的位置。
//         // 基于采样点的位置数据，通过插值计算可以获取任意时间点上的位置信息
//         const sampled = new Cesium.SampledPositionProperty();
//         //添加一个 时间-位置 对样本。getValue(time, result)：根据给定时间获取插值后的属性值。
//         sampled.addSample(now, start);
//         sampled.addSample(stop, end);

//         const velOri = new Cesium.VelocityOrientationProperty(sampled);
//         const fixQuat = Cesium.Quaternion.fromAxisAngle(
//             Cesium.Cartesian3.UNIT_Z,
//             Cesium.Math.toRadians(-90)
//         );

//         // ===== 强制对齐 Cesium 时钟 =====
//         viewer.clock.startTime = now.clone();
//         viewer.clock.currentTime = now.clone();
//         viewer.clock.stopTime = stop.clone();
//         viewer.clock.shouldAnimate = true;
//         //创建一个带有模型、位置、朝向和生命周期的车辆实体
//         const ent = viewer.entities.add({
//             availability: new Cesium.TimeIntervalCollection([
//                 new Cesium.TimeInterval({ start: now, stop })
//             ]),
//             position: sampled,
//             // orientation: velOri,
//             orientation: new Cesium.CallbackProperty(
//                 (time?: Cesium.JulianDate, result?: Cesium.Quaternion) => {
//                     if (!time) return undefined;
//                     const q = velOri.getValue(time);
//                     if (!q) return undefined;
//                     // result = q * fixQuat
//                     return Cesium.Quaternion.multiply(
//                         q,
//                         fixQuat,
//                         result || new Cesium.Quaternion()
//                     );
//                 },
//                 false
//             ),
//             model: {
//                 uri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
//                 minimumPixelSize: 40
//             }
//         });

//         vehicleEntities.push(ent);
//         console.log(
//             `[RoadVisual] Spawned realtime vehicle of type ${type}, will live for ${lifeSeconds} seconds`
//         );

//         // 自动清理，防止实体爆炸
//         setTimeout(() => {
//             viewer?.entities.remove(ent);
//         }, lifeSeconds * 1000);
//     }
// }

let ws: WebSocket | null = null;

// 前端初始化 WebSocket 连接
function initSocket() {
    ws = new WebSocket("ws://127.0.0.1:8765"); //建立实例，指定服务器地址

    ws.onmessage = (ev) => {
        console.log("[WS] message received");
        console.log("[WS raw]", ev.data);

        let msg: any;
        try {
            msg = JSON.parse(ev.data);
        } catch (e) {
            console.error("[WS parse error]", e);
            return;
        }

        console.log("[WS parsed]", msg);

        if (msg.type === "line_cross") {
            const videoId = msg.video_id ?? "default";
            const cls = msg.payload?.class ?? "car";
            console.log("[WS] spawn vehicle", msg.payload);
            spawnRealtimeVehicle(videoId, cls);
            return;
        }
        if (msg.type === "task_finished") {
            console.log(`[WS] task_finished video_id=${msg.video_id}`);
            return;
        }

        if (msg.type === "task_error") {
            console.error(
                `[WS] task_error video_id=${msg.video_id}`,
                msg.error
            );
            return;
        }
    };

    ws.onopen = () => console.log("WS connected");
    ws.onerror = (e) => console.error("WS error", e);
}

function flyToInitView() {
    if (editor && editor.viewer) {
        viewer = editor.viewer;
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                117.48463609349766, // lon 117.484233
                40.44651364265419, // lat
                628 // height
            ),
            duration: 1.5
        });
    }
}

let trajectoriesLoaded = false;

onMounted(() => {
    // 保证页面一打开，轨迹就常亮展示
    if (trajectoriesLoaded) return;
    if (editor && editor.viewer) {
        loadTrajectories();
        trajectoriesLoaded = true;
    } else {
        const stopWatch = watch(
            () => editor?.viewer,
            (v) => {
                if (v && !trajectoriesLoaded) {
                    loadTrajectories();
                    trajectoriesLoaded = true;
                    stopWatch();
                }
            }
        );
    }
});

function videoVehicle() {
    if (editor && editor.viewer) {
        viewer = editor.viewer;

        console.log("[RoadVisual] viewer bound");

        flyToInitView();
        initSocket();

        viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(
                117.48463609349766,
                40.44651364265419,
                628
            ),
            point: { pixelSize: 6, color: Cesium.Color.RED },
            label: { text: "VIEWER READY" }
        });
    }
}

/**
 * 隧道裁剪
 *
 */
function enableTunnelClipping() {
    if (!viewer) return;

    const tunnelCenter = Cartesian3.fromDegrees(116.391, 39.901, 500);

    viewer.scene.globe.clippingPlanes =
        createTunnelClippingPlanes(tunnelCenter);
}

defineExpose({ loadRoadData, loadTrajectories, videoVehicle });
</script>

<style scoped></style>
