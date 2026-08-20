<template>
    <div class="road-visualization" v-if="true">
        <div v-if="isTrajectoryTimelineVisible" class="trajectory-timeline-control">
            <div class="timeline-container">
                <button
                    class="timeline-btn play-btn"
                    @click="
                        isTrajectoryPlaying
                            ? pauseTrajectoryPlayback()
                            : resumeTrajectoryPlayback()
                    "
                    :title="isTrajectoryPlaying ? '暂停' : '播放'"
                >
                    {{ isTrajectoryPlaying ? "⏸" : "▶" }}
                </button>

                <div class="progress-container">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        :value="trajectoryTimelineProgress"
                        @input="
                            (e) =>
                                handleTrajectoryTimelineChange(
                                    parseFloat(
                                        (e.target as HTMLInputElement).value
                                    )
                                )
                        "
                        class="timeline-slider"
                    />
                </div>

                <div class="progress-percent">
                    {{ Math.round(trajectoryTimelineProgress) }}%
                </div>
            </div>
        </div>
        <!-- 交通态势时间线控制条 -->
        <div v-if="isTrafficAnalysis" class="traffic-timeline-control">
            <div class="timeline-container">
                <!-- 播放/暂停按钮 -->
                <button
                    class="timeline-btn play-btn"
                    @click="
                        isTrafficPlaying
                            ? pauseTrafficAnimation()
                            : resumeTrafficAnimation()
                    "
                    :title="isTrafficPlaying ? '暂停' : '播放'"
                >
                    {{ isTrafficPlaying ? "⏸" : "▶" }}
                </button>

                <!-- 进度条 -->
                <div class="progress-container">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        :value="trafficTimelineProgress"
                        @input="
                            (e) =>
                                handleTimelineChange(
                                    parseFloat(
                                        (e.target as HTMLInputElement).value
                                    )
                                )
                        "
                        class="timeline-slider"
                    />
                </div>

                <!-- 时间戳显示 -->
                <div class="timestamp-display">
                    {{ currentTrafficTimestamp || "未加载数据" }}
                </div>

                <!-- 进度百分比 -->
                <div class="progress-percent">
                    {{ Math.round(trafficTimelineProgress) }}%
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { storeToRefs } from "pinia";
import { nanoid } from "nanoid";
import { ElMessage } from "element-plus";

const store = useGeoOasisStore();
const { editor, isTrafficAnalysis } = storeToRefs(store);
let viewer: Cesium.Viewer | null = null;
const roadEntities: Cesium.Entity[] = [];
const roadCityUrl = "/data/roadCity.json";
let roadCityLoadPromise: Promise<void> | null = null;
let isLoadingCpgs84RoadLayers = false;
type Cpgs84RoadLayer = {
    name: string;
    url: string;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    fillOpacity?: number;
    zIndex: number;
};
const cpgs84RoadLayers: Cpgs84RoadLayer[] = [
    {
        name: "RoadSection",
        url: "/data/cpgs84/RoadSection.geojson",
        fillColor:'#64748B',
        fillOpacity: 0.85,
        zIndex: 10
    },
    {
        name: "LanePolygon",
        url: "/data/cpgs84/LanePolygon.geojson",
        fillColor: "#99968E",
        fillOpacity: 0.8,
        zIndex: 20
    },
    {
        name: "RoadCenterLine",
        url: "/data/cpgs84/RoadCenterLine.geojson",
        strokeColor: "#1E40AF",
        strokeWidth: 4,
        zIndex: 100
    },
    {
        name: "LaneCenterline",
        url: "/data/cpgs84/LaneCenterline.geojson",
        strokeColor: "#f6de07",
        strokeWidth: 2,
        zIndex: 110
    }
];


// 交通态势预测相关状态
const trafficEntities: Cesium.Entity[] = [];
const trafficDataMap = new Map<
    string,
    { coordinates: number[][]; traffic_level: Record<string, number> }
>();
let trafficDataSource: Cesium.CustomDataSource | null = null;
let trafficTimelineIndex = 0;
let trafficTimestamps: string[] = [];
let trafficAnimationTimer: ReturnType<typeof setInterval> | null = null;
const TRAFFIC_UPDATE_INTERVAL = 1000; // 1秒更新一次

// 时间线控制条相关状态
const trafficTimelineProgress = ref(0); // 0-100
const isTrafficPlaying = ref(false); // 播放状态
const currentTrafficTimestamp = ref(""); // 当前时间戳显示

const isTrajectoryTimelineVisible = ref(false);
const isTrajectoryPlaying = ref(false);
const trajectoryTimelineProgress = ref(0);
let trajectoryStartTime: Cesium.JulianDate | null = null;
let trajectoryStopTime: Cesium.JulianDate | null = null;
let removeTrajectoryClockListener: (() => void) | null = null;

/** 最终未使用，而是根据level返回颜色
 * 根据速度值返回对应的颜色（60快速绿色、40正常黄色、20缓慢橙色、<20拥堵红色）
 */
// function getSpeedColor(speed: number): Cesium.Color {
//     if (speed >= 60) {
//         return Cesium.Color.GREEN.withAlpha(0.8);
//     } else if (speed >= 40) {
//         return Cesium.Color.YELLOW.withAlpha(0.8);
//     } else if (speed >= 20) {
//         return Cesium.Color.ORANGE.withAlpha(0.8);
//     } else {
//         return Cesium.Color.RED.withAlpha(0.8);
//     }
// }

// function getSpeedColorNormalized(speed: number): Cesium.Color {
//    const minSpeed = 0.00303;
//    const maxSpeed = 39.0683;

    // 归一化速度到 0~1
//    const ratio = Cesium.Math.clamp(
//        (speed - minSpeed) / (maxSpeed - minSpeed),
//        0.0,
//        1.0
//    );

    // 使用渐变颜色: 红->橙->黄->绿
//    if (ratio >= 0.75) {
//       return Cesium.Color.GREEN.withAlpha(0.8);
//    } else if (ratio >= 0.5) {
//        return Cesium.Color.YELLOW.withAlpha(0.8);
//    } else if (ratio >= 0.25) {
//        return Cesium.Color.ORANGE.withAlpha(0.8);
//    } else {
//       return Cesium.Color.RED.withAlpha(0.8);
//    }
//}

function getTrafficLevelColor(level: number): Cesium.Color {
    switch (level) {
        case 1:
            return Cesium.Color.GREEN.withAlpha(0.8); // 畅通
        case 2:
            return Cesium.Color.CYAN.withAlpha(0.8); // 基本畅通
        case 3:
            return Cesium.Color.YELLOW.withAlpha(0.8); // 轻度拥堵
        case 4:
            return Cesium.Color.ORANGE.withAlpha(0.8); // 中度拥堵
        case 5:
            return Cesium.Color.RED.withAlpha(0.8); // 严重拥堵
        default:
            return Cesium.Color.GRAY.withAlpha(0.5); // 无数据
    }
}
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

        /*
        // viewer?.flyTo(roadEntities[0]);
        viewer?.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(117.415, 40.3999, 1000) //兴隆西收费站附近
        });
        */
    } catch (error) {
        console.error("Error loading GeoJSON:", error);
    }
};

function flyToCpgs84RoadView() {
    // viewer?.flyTo(roadEntities[0]);
    viewer?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(117.415, 40.3999, 1000) //兴隆西收费站附近
    });
}

function deleteExistingCpgs84RoadLayers() {
    const currentEditor = editor.value;
    if (!currentEditor) {
        return;
    }

    const roadLayerUrls = new Set(cpgs84RoadLayers.map((layer) => layer.url));
    const layerIds = Array.from(currentEditor.layers.entries())
        .filter(([, layerYMap]) => {
            return (
                layerYMap.get("type") === "service" &&
                layerYMap.get("provider") === "geojson" &&
                roadLayerUrls.has(layerYMap.get("url"))
            );
        })
        .map(([id]) => id);

    layerIds.forEach((id) => {
        currentEditor.deleteLayer(id);
    });
}

async function loadRoadData() {
    const currentEditor = editor.value;
    if (currentEditor?.viewer) {
        viewer = currentEditor.viewer;
        flyToCpgs84RoadView();
        // GeoJSON文件URL
        if (roadEntities.length === 0) {
            roadCityLoadPromise ??= loadGeoJSON(roadCityUrl).finally(() => {
                roadCityLoadPromise = null;
            });
            await roadCityLoadPromise;
        }
        if (isLoadingCpgs84RoadLayers) {
            return;
        }

        isLoadingCpgs84RoadLayers = true;
        try {
            deleteExistingCpgs84RoadLayers();
            cpgs84RoadLayers.forEach((layer) => {
                currentEditor.addLayer({
                    id: nanoid(),
                    name: layer.name,
                    type: "service",
                    provider: "geojson",
                    url: layer.url,
                    show: true,
                    clampToGround: true,
                    ...(layer.strokeColor
                        ? { strokeColor: layer.strokeColor }
                        : {}),
                    ...(layer.strokeWidth
                        ? { strokeWidth: layer.strokeWidth }
                        : {}),
                    ...(layer.fillColor ? { fillColor: layer.fillColor } : {}),
                    ...(layer.fillOpacity !== undefined
                        ? { fillOpacity: layer.fillOpacity }
                        : {}),
                    zIndex: layer.zIndex
                });
            });
        } finally {
            isLoadingCpgs84RoadLayers = false;
        }
    } else {
        console.error("Editor or Viewer is not available");
    }
}

/**
 * 加载并解析交通态势数据（GeoJSON格式，包含不同时刻的速度）
 */
async function loadTrafficData() {
    if (!editor?.value.viewer) return;
    viewer = editor.value.viewer;

    try {
        const response = await fetch("/data/cpgs84/chengping_traffic_with_speeds.geojson");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        trafficDataMap.clear();
        trafficTimestamps = [];
        const timestampSet = new Set<string>();

        // 提取所有时间戳和路网数据
        data.features.forEach((feature: any) => {
            if (feature.geometry.type === "LineString") {
                const roadId = feature.properties.Id;
                const coordinates = feature.geometry.coordinates;
                const traffic_level = feature.properties.traffic_level || {};

                trafficDataMap.set(roadId, {
                    coordinates,
                    traffic_level
                });

                // 收集所有时间戳
                Object.keys(traffic_level).forEach((ts) =>
                    timestampSet.add(ts)
                );
            }
        });

        // 排序时间戳
        trafficTimestamps = Array.from(timestampSet).sort();
        console.log(
            `[Traffic] Loaded ${trafficDataMap.size} roads with ${trafficTimestamps.length} timestamps`
        );

        // 初始化显示第一个时间点的数据
        if (trafficTimestamps.length > 0) {
            updateTrafficDisplay(0);
        }
    } catch (error) {
        console.error("Error loading traffic data:", error);
    }
}

/**
 * 更新交通态势的实时显示（根据时间戳索引）
 */
function updateTrafficDisplay(timestampIndex: number) {
    if (
        !viewer ||
        timestampIndex < 0 ||
        timestampIndex >= trafficTimestamps.length
    ) {
        return;
    }

    const currentTimestamp = trafficTimestamps[timestampIndex];
    if (!trafficDataSource) {
        trafficDataSource = new Cesium.CustomDataSource("cpgs_traffic_analysis");
        viewer.dataSources.add(trafficDataSource);
    }
    viewer.dataSources.raiseToTop(trafficDataSource);

    // 更新进度条和时间戳显示
    trafficTimelineProgress.value =
        (timestampIndex / (trafficTimestamps.length - 1)) * 100;
    currentTrafficTimestamp.value = currentTimestamp;

    // 清除旧的交通实体
    trafficEntities.forEach((entity) =>
        trafficDataSource?.entities.remove(entity)
    );
    trafficEntities.length = 0;

    // 为每条路创建新的实体，根据当前时间戳的速度值着色
    trafficDataMap.forEach((roadData, roadId) => {
        const { coordinates, traffic_level } = roadData;
        const speed = traffic_level[currentTimestamp];

        if (speed !== undefined) {
            const positions = coordinates.map((coord: any) =>
                Cesium.Cartesian3.fromDegrees(coord[0], coord[1], 0)
            );

            const color = getTrafficLevelColor(speed);

            const entity = trafficDataSource?.entities.add({
                name: `Road-${roadId}`,
                polyline: {
                    positions: positions,
                    width: 6,
                    material: color,
                    clampToGround: true,
                    zIndex: new Cesium.ConstantProperty(10000)
                }
            });

            if (entity) {
                trafficEntities.push(entity);
            }
        }
    });
    viewer.dataSources.raiseToTop(trafficDataSource);

    console.log(
        `[Traffic Update] Timestamp: ${currentTimestamp}, Entities: ${trafficEntities.length}`
    );
}

/**
 * 启动交通态势动画时间轴
 */
function startTrafficAnimation() {
    if (trafficAnimationTimer) {
        clearInterval(trafficAnimationTimer);
    }

    trafficTimelineIndex = 0;
    isTrafficPlaying.value = true;

    trafficAnimationTimer = setInterval(() => {
        updateTrafficDisplay(trafficTimelineIndex);
        trafficTimelineIndex =
            (trafficTimelineIndex + 1) % trafficTimestamps.length;
    }, TRAFFIC_UPDATE_INTERVAL);

    console.log("[Traffic] Animation started");
}

/**
 * 停止交通态势动画
 */
function stopTrafficAnimation() {
    if (trafficAnimationTimer) {
        clearInterval(trafficAnimationTimer);
        trafficAnimationTimer = null;
    }

    isTrafficPlaying.value = false;

    // 清除所有交通实体
    trafficEntities.forEach((entity) =>
        trafficDataSource?.entities.remove(entity)
    );
    trafficEntities.length = 0;

    console.log("[Traffic] Animation stopped");
}

/**
 * 暂停交通态势动画
 */
function pauseTrafficAnimation() {
    if (trafficAnimationTimer) {
        clearInterval(trafficAnimationTimer);
        trafficAnimationTimer = null;
    }
    isTrafficPlaying.value = false;
    console.log("[Traffic] Animation paused");
}

/**
 * 恢复交通态势动画
 */
function resumeTrafficAnimation() {
    if (isTrafficPlaying.value || trafficAnimationTimer) {
        return; // 已在播放
    }

    isTrafficPlaying.value = true;

    trafficAnimationTimer = setInterval(() => {
        updateTrafficDisplay(trafficTimelineIndex);
        trafficTimelineIndex =
            (trafficTimelineIndex + 1) % trafficTimestamps.length;
    }, TRAFFIC_UPDATE_INTERVAL);

    console.log("[Traffic] Animation resumed");
}

/**
 * 手动调节时间线进度条
 */
function handleTimelineChange(progress: number) {
    if (trafficTimestamps.length === 0) return;

    // 暂停自动播放
    pauseTrafficAnimation();

    // 根据进度条值计算时间戳索引
    trafficTimelineIndex = Math.round(
        (progress / 100) * (trafficTimestamps.length - 1)
    );
    trafficTimelineIndex = Math.max(
        0,
        Math.min(trafficTimelineIndex, trafficTimestamps.length - 1)
    );

    // 更新显示
    updateTrafficDisplay(trafficTimelineIndex);
    console.log(
        `[Traffic] Timeline changed to: ${trafficTimelineProgress.value}%, Index: ${trafficTimelineIndex}`
    );
}

/**
 * 加载并可视化轨迹数据
 */
const vehicleEntities: Cesium.Entity[] = [];
const k37TrajectoryEntities: Cesium.Entity[] = [];
let k37TrajectoryDataSource: Cesium.CustomDataSource | null = null;
const TRAJECTORY_URL =
    "/data/cpgs84/Trajectory/k38_full_single_run_with_ModelHeight.csv";
const TRAJECTORY_MODEL_URL = "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf";
const TRAJECTORY_HEIGHT_TILESET_PATH = "/3dtiles/wgs84/tileset.json";
const TRAJECTORY_FRAME_RATE = 25;  //假定帧率
const TRAJECTORY_MODEL_HEIGHT = 0;
const TRAJECTORY_MODEL_HEIGHT_OFFSET = 0.1;
const TRAJECTORY_COLOR = Cesium.Color.CYAN.withAlpha(0.95);
const TRAJECTORY_HEIGHT_BATCH_SIZE = 500;
let isK37TrajectoriesLoaded = false;
let isLoadingK37Trajectories = false;

type K37TrajectoryPoint = {
    trackId: string;
    frame: number;
    lon: number;
    lat: number;
    rowIndex: number;
    modelHeight?: number;
};

type ParsedK37TrajectoryCsv = {
    headers: string[];
    rows: string[][];
    groups: Map<string, K37TrajectoryPoint[]>;
    modelHeightIndex: number;
};

function stopTrajectoryTimelineSync() {
    if (removeTrajectoryClockListener) {
        removeTrajectoryClockListener();
        removeTrajectoryClockListener = null;
    }
}

function updateTrajectoryTimelineProgress() {
    if (!viewer || !trajectoryStartTime || !trajectoryStopTime) {
        return;
    }

    const totalSeconds = Cesium.JulianDate.secondsDifference(
        trajectoryStopTime,
        trajectoryStartTime
    );
    if (totalSeconds <= 0) {
        trajectoryTimelineProgress.value = 100;
        isTrajectoryPlaying.value = false;
        return;
    }

    const elapsedSeconds = Cesium.JulianDate.secondsDifference(
        viewer.clock.currentTime,
        trajectoryStartTime
    );
    const progress = Cesium.Math.clamp(
        (elapsedSeconds / totalSeconds) * 100,
        0,
        100
    );
    trajectoryTimelineProgress.value = progress;

    if (progress >= 100) {
        isTrajectoryPlaying.value = false;
    } else {
        isTrajectoryPlaying.value = viewer.clock.shouldAnimate;
    }
}

function startTrajectoryTimelineSync() {
    stopTrajectoryTimelineSync();
    updateTrajectoryTimelineProgress();

    if (!viewer) {
        return;
    }

    removeTrajectoryClockListener = viewer.clock.onTick.addEventListener(() => {
        updateTrajectoryTimelineProgress();
    });
}

function resetTrajectoryTimeline() {
    stopTrajectoryTimelineSync();
    trajectoryStartTime = null;
    trajectoryStopTime = null;
    trajectoryTimelineProgress.value = 0;
    isTrajectoryTimelineVisible.value = false;
    isTrajectoryPlaying.value = false;
}

function pauseTrajectoryPlayback() {
    if (!viewer) {
        return;
    }

    viewer.clock.shouldAnimate = false;
    isTrajectoryPlaying.value = false;
    updateTrajectoryTimelineProgress();
}

function resumeTrajectoryPlayback() {
    if (!viewer || !trajectoryStartTime || !trajectoryStopTime) {
        return;
    }

    if (trajectoryTimelineProgress.value >= 100) {
        viewer.clock.currentTime = trajectoryStartTime.clone();
        trajectoryTimelineProgress.value = 0;
    }

    viewer.clock.shouldAnimate = true;
    isTrajectoryPlaying.value = true;
    updateTrajectoryTimelineProgress();
}

function handleTrajectoryTimelineChange(progress: number) {
    if (!viewer || !trajectoryStartTime || !trajectoryStopTime) {
        return;
    }

    const normalizedProgress = Cesium.Math.clamp(progress, 0, 100);
    const totalSeconds = Cesium.JulianDate.secondsDifference(
        trajectoryStopTime,
        trajectoryStartTime
    );

    viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
        trajectoryStartTime,
        (normalizedProgress / 100) * totalSeconds,
        new Cesium.JulianDate()
    );
    viewer.clock.shouldAnimate = false;
    trajectoryTimelineProgress.value = normalizedProgress;
    isTrajectoryPlaying.value = false;
}

function parseCsvLine(line: string) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

function parseK37TrajectoryCsv(csvText: string): ParsedK37TrajectoryCsv {
    const lines = csvText
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim());
    if (lines.length < 2) {
        return {
            headers: [],
            rows: [],
            groups: new Map<string, K37TrajectoryPoint[]>(),
            modelHeightIndex: -1
        };
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.trim());
    const columnIndex = new Map(
        headers.map((header, index) => [header, index])
    );
    const requiredColumns = ["frame", "track_id", "longitude", "latitude"];

    for (const column of requiredColumns) {
        if (!columnIndex.has(column)) {
            throw new Error(`Missing required CSV column: ${column}`);
        }
    }

    const frameIndex = columnIndex.get("frame")!;
    const trackIndex = columnIndex.get("track_id")!;
    const lonIndex = columnIndex.get("longitude")!;
    const latIndex = columnIndex.get("latitude")!;
    const modelHeightIndex = columnIndex.get("ModelHeight") ?? -1;
    const groups = new Map<string, K37TrajectoryPoint[]>();
    const rows = lines.slice(1).map((line) => parseCsvLine(line));

    for (const [rowIndex, values] of rows.entries()) {
        const frame = Number(values[frameIndex]);
        const trackId = values[trackIndex]?.trim();
        const lon = Number(values[lonIndex]);
        const lat = Number(values[latIndex]);
        const modelHeightText =
            modelHeightIndex >= 0
                ? values[modelHeightIndex]?.trim()
                : undefined;
        const modelHeight = modelHeightText
            ? Number(modelHeightText)
            : undefined;

        if (
            !trackId ||
            !Number.isFinite(frame) ||
            !Number.isFinite(lon) ||
            !Number.isFinite(lat)
        ) {
            continue;
        }

        if (!groups.has(trackId)) {
            groups.set(trackId, []);
        }

        groups.get(trackId)!.push({
            trackId,
            frame,
            lon,
            lat,
            rowIndex,
            modelHeight: Number.isFinite(modelHeight) ? modelHeight : undefined
        });
    }

    for (const points of groups.values()) {
        points.sort((a, b) => a.frame - b.frame);
    }

    return { headers, rows, groups, modelHeightIndex };
}

function normalizeResourcePath(resourceUrl: string) {
    try {
        return decodeURIComponent(
            new URL(resourceUrl, window.location.href).pathname
        )
            .replace(/\\/g, "/")
            .toLowerCase();
    } catch {
        return resourceUrl.replace(/\\/g, "/").toLowerCase();
    }
}

function findTrajectoryHeightTileset() {
    if (!viewer) {
        return undefined;
    }

    const primitives = viewer.scene.primitives;
    for (let index = 0; index < primitives.length; index++) {
        const primitive = primitives.get(index);
        if (
            primitive instanceof Cesium.Cesium3DTileset &&
            normalizeResourcePath(primitive.resource.url) ===
                TRAJECTORY_HEIGHT_TILESET_PATH
        ) {
            return primitive;
        }
    }

    return undefined;
}

function escapeCsvField(value: string) {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function downloadTrajectoryCsv(
    parsedCsv: ParsedK37TrajectoryCsv,
    heightsByRow: Map<number, number>
) {
    const headers = [...parsedCsv.headers, "ModelHeight"];
    const rows = parsedCsv.rows.map((sourceRow, rowIndex) => {
        const row = [...sourceRow];
        while (row.length < parsedCsv.headers.length) {
            row.push("");
        }
        row.push(
            heightsByRow.has(rowIndex)
                ? heightsByRow.get(rowIndex)!.toFixed(3)
                : ""
        );
        return row;
    });
    const csv = [headers, ...rows]
        .map((row) => row.map(escapeCsvField).join(","))
        .join("\r\n");
    const sourceName = TRAJECTORY_URL.split("/").pop() ?? "trajectory.csv";
    const downloadName = sourceName.replace(/\.csv$/i, "_with_ModelHeight.csv");
    const blobUrl = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

async function calculateAndDownloadModelHeights(
    parsedCsv: ParsedK37TrajectoryCsv,
    targetTileset: Cesium.Cesium3DTileset
) {
    if (!viewer?.scene.sampleHeightSupported) {
        throw new Error("当前浏览器不支持三维场景高度采样");
    }

    const points = Array.from(parsedCsv.groups.values()).flat();
    const heightsByRow = new Map<number, number>();
    const objectsToExclude: object[] = [];
    const primitives = viewer.scene.primitives;
    for (let index = 0; index < primitives.length; index++) {
        const primitive = primitives.get(index);
        if (primitive !== targetTileset) {
            objectsToExclude.push(primitive);
        }
    }

    const originalGlobeShow = viewer.scene.globe.show;
    const originalTilesetShow = targetTileset.show;
    viewer.scene.globe.show = false;
    targetTileset.show = true;

    try {
        for (
            let start = 0;
            start < points.length;
            start += TRAJECTORY_HEIGHT_BATCH_SIZE
        ) {
            const batchPoints = points.slice(
                start,
                start + TRAJECTORY_HEIGHT_BATCH_SIZE
            );
            const positions = batchPoints.map((point) =>
                Cesium.Cartographic.fromDegrees(point.lon, point.lat)
            );
            const sampledPositions =
                await viewer.scene.sampleHeightMostDetailed(
                    positions,
                    objectsToExclude
                );

            sampledPositions.forEach((position, index) => {
                if (position && Number.isFinite(position.height)) {
                    heightsByRow.set(
                        batchPoints[index].rowIndex,
                        position.height
                    );
                }
            });

            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
    } finally {
        viewer.scene.globe.show = originalGlobeShow;
        targetTileset.show = originalTilesetShow;
    }

    const missingCount = points.length - heightsByRow.size;
    if (missingCount > 0) {
        throw new Error(
            `有 ${missingCount} 个轨迹点未能从指定道路模型获取高度，未生成 CSV`
        );
    }

    downloadTrajectoryCsv(parsedCsv, heightsByRow);
}

function clearK37Trajectories() {
    resetTrajectoryTimeline();

    if (!viewer && editor?.value?.viewer) {
        viewer = editor.value.viewer;
    }

    if (viewer) {
        if (k37TrajectoryDataSource) {
            k37TrajectoryDataSource.entities.removeAll();
        }

        const staleEntities = viewer.entities.values.filter((entity) =>
            entity.id.startsWith("k37-veh-")
        );
        for (const entity of staleEntities) {
            viewer.entities.remove(entity);
        }
    }

    k37TrajectoryEntities.length = 0;
    isK37TrajectoriesLoaded = false;
}

async function loadK37Trajectories() {
    if (!editor?.value?.viewer) {
        return;
    }

    viewer = editor.value.viewer;
    clearK37Trajectories();
    if (!k37TrajectoryDataSource) {
        k37TrajectoryDataSource = new Cesium.CustomDataSource(
            "k37_trajectories"
        );
        viewer.dataSources.add(k37TrajectoryDataSource);
    }
    viewer.dataSources.raiseToTop(k37TrajectoryDataSource);

    console.log(`[RoadVisual] Loading k37 trajectories: ${TRAJECTORY_URL}`);
    const res = await fetch(`${TRAJECTORY_URL}?t=${Date.now()}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch k37 CSV: HTTP ${res.status}`);
    }

    const csvText = await res.text();
    const parsedCsv = parseK37TrajectoryCsv(csvText);
    const groups = parsedCsv.groups;

    if (groups.size === 0) {
        console.warn("[RoadVisual] No valid k37 trajectory points");
        return;
    }

    const trajectoryHeightTileset = findTrajectoryHeightTileset();
    if (trajectoryHeightTileset && parsedCsv.modelHeightIndex < 0) {
        const loadingMessage = ElMessage({
            message: "正在根据道路三维模型计算轨迹高度，请稍候…",
            type: "info",
            duration: 0
        });
        try {
            await calculateAndDownloadModelHeights(
                parsedCsv,
                trajectoryHeightTileset
            );
            ElMessage.success(
                "已下载包含 ModelHeight 的 CSV，请人工替换原文件后再次点击轨迹数据映射"
            );
        } finally {
            loadingMessage.close();
        }
        return;
    }

    const useModelHeight = Boolean(
        trajectoryHeightTileset && parsedCsv.modelHeightIndex >= 0
    );
    if (useModelHeight) {
        const invalidPoint = Array.from(groups.values())
            .flat()
            .find((point) => !Number.isFinite(point.modelHeight));
        if (invalidPoint) {
            throw new Error(
                `CSV 第 ${invalidPoint.rowIndex + 2} 行的 ModelHeight 无效`
            );
        }
    }

    let minFrame = Number.POSITIVE_INFINITY;
    let maxFrame = Number.NEGATIVE_INFINITY;
    let firstTrajectoryPoint: K37TrajectoryPoint | null = null;
    for (const points of groups.values()) {
        if (points.length === 0) continue;
        minFrame = Math.min(minFrame, points[0].frame);
        maxFrame = Math.max(maxFrame, points[points.length - 1].frame);
        if (
            !firstTrajectoryPoint ||
            points[0].frame < firstTrajectoryPoint.frame
        ) {
            firstTrajectoryPoint = points[0];
        }
    }

    const startJD = Cesium.JulianDate.now();
    const stopJD = Cesium.JulianDate.addSeconds(
        startJD,
        (maxFrame - minFrame) / TRAJECTORY_FRAME_RATE,
        new Cesium.JulianDate()
    );

    for (const [trackId, points] of groups) {
        if (points.length === 0) continue;

        const sampled = new Cesium.SampledPositionProperty();
        const trackSamples: Array<{
            seconds: number;
            position: Cesium.Cartesian3;
        }> = [];
        const vehicleStartJD = Cesium.JulianDate.addSeconds(
            startJD,
            (points[0].frame - minFrame) / TRAJECTORY_FRAME_RATE,
            new Cesium.JulianDate()
        );
        const vehicleStopJD = Cesium.JulianDate.addSeconds(
            startJD,
            (points[points.length - 1].frame - minFrame) / TRAJECTORY_FRAME_RATE,
            new Cesium.JulianDate()
        );

        for (const point of points) {
            const seconds = (point.frame - minFrame) / TRAJECTORY_FRAME_RATE;
            const pointTime = Cesium.JulianDate.addSeconds(
                startJD,
                seconds,
                new Cesium.JulianDate()
            );
            const position = Cesium.Cartesian3.fromDegrees(
                point.lon,
                point.lat,
                useModelHeight
                    ? point.modelHeight! + TRAJECTORY_MODEL_HEIGHT_OFFSET
                    : TRAJECTORY_MODEL_HEIGHT
            );
            sampled.addSample(pointTime, position);
            trackSamples.push({ seconds, position });
        }

        const velOri = new Cesium.VelocityOrientationProperty(sampled);
        const fixQuat = Cesium.Quaternion.fromAxisAngle(
            Cesium.Cartesian3.UNIT_Z,
            Cesium.Math.toRadians(-90)
        );
        viewer.entities.removeById(`k37-veh-${trackId}`);
        k37TrajectoryDataSource.entities.removeById(`k37-veh-${trackId}`);
        const entity = k37TrajectoryDataSource.entities.add({
            id: `k37-veh-${trackId}`,
            name: `k37-${trackId}`,
            availability: new Cesium.TimeIntervalCollection([
                new Cesium.TimeInterval({
                    start: vehicleStartJD,
                    stop: vehicleStopJD
                })
            ]),
            position: sampled,
            orientation: new Cesium.CallbackProperty(
                (time?: Cesium.JulianDate, result?: Cesium.Quaternion) => {
                    if (!time) return undefined;
                    const q = velOri.getValue(time);
                    if (!q) return undefined;
                    return Cesium.Quaternion.multiply(
                        q,
                        fixQuat,
                        result || new Cesium.Quaternion()
                    );
                },
                false
            ),
            model: {
                uri: TRAJECTORY_MODEL_URL,
                heightReference: useModelHeight
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.CLAMP_TO_GROUND,
                minimumPixelSize: 40,
                maximumScale: 20
            },
            point: {
                pixelSize: 8,
                color: TRAJECTORY_COLOR,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                heightReference: useModelHeight
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            polyline: {
                positions: new Cesium.CallbackProperty((time) => {
                    if (!time) return [];
                    const elapsed = Cesium.JulianDate.secondsDifference(
                        time,
                        startJD
                    );
                    return trackSamples
                        .filter(
                            (sample) =>
                                sample.seconds <= elapsed
                        )
                        .map((sample) => sample.position);
                }, false),
                width: 3,
                material: TRAJECTORY_COLOR,
                clampToGround: !useModelHeight,
                zIndex: new Cesium.ConstantProperty(20000)
            },
            label: {
                text: trackId,
                font: "12px sans-serif",
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                heightReference: useModelHeight
                    ? Cesium.HeightReference.NONE
                    : Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                pixelOffset: new Cesium.Cartesian2(0, -30)
            }
        });

        k37TrajectoryEntities.push(entity);
    }

    viewer.clock.startTime = startJD.clone();
    viewer.clock.stopTime = stopJD.clone();
    viewer.clock.currentTime = startJD.clone();
    viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
    viewer.clock.multiplier = 1;
    viewer.clock.shouldAnimate = true;
    trajectoryStartTime = startJD.clone();
    trajectoryStopTime = stopJD.clone();
    trajectoryTimelineProgress.value = 0;
    isTrajectoryTimelineVisible.value = true;
    isTrajectoryPlaying.value = true;
    startTrajectoryTimelineSync();
    viewer.dataSources.raiseToTop(k37TrajectoryDataSource);
    if (firstTrajectoryPoint) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                firstTrajectoryPoint.lon,
                firstTrajectoryPoint.lat,
                1000
            )
        });
    }
    isK37TrajectoriesLoaded = true;
    console.log(
        `[RoadVisual] Loaded ${k37TrajectoryEntities.length} k37 trajectories`
    );

    return k37TrajectoryEntities;
}

async function toggleK37Trajectories() {
    if (isLoadingK37Trajectories) {
        return;
    }

    if (isK37TrajectoriesLoaded) {
        clearK37Trajectories();
        return;
    }

    isLoadingK37Trajectories = true;
    try {
        await loadK37Trajectories();
    } catch (err) {
        console.error("[RoadVisual] Failed to load k37 trajectories:", err);
        ElMessage.error(
            err instanceof Error ? err.message : "轨迹数据映射失败"
        );
        clearK37Trajectories();
    } finally {
        isLoadingK37Trajectories = false;
    }
}

async function loadTrajectories(
    trajUrl = "/data/20251030_163823_170604/Simulatedtrajectory1.json",
    assetIndex = 2
) {
    if (editor?.value && editor.value.viewer) {
        viewer = editor.value.viewer;
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
                editor.value!.assetLibrary.getAssetId(assetIndex) ?? "asset-4";
            const modelUrl =
                await editor.value!.assetLibrary.getAssetUrl(assetId);

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
                const showByDistance = modelDistanceThreshold;

                if (showByDistance < 0) {
                    // keep data usage for TS strict check
                    console.warn("unexpected distance");
                }

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
                if (target) {
                    // 保留对 target 的引用，防止未使用警告
                    console.debug("Trajectory visualization target", target.id);
                }
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

const VIDEO_ROUTE_VIEW = Cesium.Cartesian3.fromDegrees(
    117.42073831,
    40.39876144,
    628
);

const ROAD_LANES: Record<string, LaneConfig> = {
    road_1: {
        start: Cesium.Cartesian3.fromDegrees(117.42073831, 40.39876144, 1),
        end: Cesium.Cartesian3.fromDegrees(117.41892631, 40.39884592, 1),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    },
    road_2: {
        start: Cesium.Cartesian3.fromDegrees(117.42073972, 40.39879482, 1),
        end: Cesium.Cartesian3.fromDegrees(117.41893177, 40.39888037, 1),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    },
    road_3: {
        start: Cesium.Cartesian3.fromDegrees(117.42074137, 40.39882646, 1),
        end: Cesium.Cartesian3.fromDegrees(117.41893003, 40.39888043, 1),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    },
    default: {
        start: Cesium.Cartesian3.fromDegrees(117.42073831, 40.39876144, 1),
        end: Cesium.Cartesian3.fromDegrees(117.41892631, 40.39884592, 1),
        modelUri: "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf",
        minimumPixelSize: 40
    }
};

function spawnRealtimeVehicle(
    videoId: string = "default",
    type: string = "car",
    lifeSeconds = 45
) {
    if (editor?.value && editor.value.viewer) {
        viewer = editor.value.viewer;

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
                    uri: lane.modelUri,
                    minimumPixelSize: lane.minimumPixelSize,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
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
                    minimumPixelSize: 40,
                    heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
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
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getVehicleWsUrl() {
    const configuredUrl = import.meta.env.VITE_VEHICLE_WS_URL;
    if (configuredUrl) return configuredUrl;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//127.0.0.1:8765`;
}

// 前端初始化 WebSocket 连接
function initSocket(retriesLeft = 0) {
    if (
        ws &&
        (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    const wsUrl = getVehicleWsUrl();
    ws = new WebSocket(wsUrl); // 建立实例，指定服务器地址

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
            const cls = msg.payload?.class === "truck" ? "truck" : "car";
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

    ws.onopen = () => {
        console.log(`[WS] connected: ${wsUrl}`);
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };
    ws.onerror = (event) => {
        console.error(`[WS] connection failed: ${wsUrl}`, event);
    };
    ws.onclose = () => {
        const shouldRetry = retriesLeft > 0;
        ws = null;
        if (shouldRetry && !reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                initSocket(retriesLeft - 1);
            }, 2000);
        }
    };
}

function connectVehicleSocket(retriesLeft = 15) {
    initSocket(retriesLeft);
}

function flyToInitView() {
    if (editor?.value?.viewer) {
        viewer = editor.value.viewer;
        viewer.camera.flyTo({
            destination: VIDEO_ROUTE_VIEW,
            duration: 1.5
        });
    }
}


// 监听交通态势分析状态
watch(
    isTrafficAnalysis,
    async (newVal) => {
        if (newVal) {
            // 启用交通态势显示
            console.log("[RoadVisual] Traffic Analysis enabled");
            if (trafficTimestamps.length === 0) {
                // 数据还未加载，先加载数据
                await loadTrafficData();
            }
            startTrafficAnimation();
        } else {
            // 禁用交通态势显示
            console.log("[RoadVisual] Traffic Analysis disabled");
            stopTrafficAnimation();
        }
    },
    { immediate: false }
);

// onMounted(() => {
//     // 保证页面一打开，轨迹就常亮展示
//     if (trajectoriesLoaded) return;
//     if (editor?.value && editor.value.viewer) {
//         loadTrajectories();
//         trajectoriesLoaded = true;
//     } else {
//         const stopWatch = watch(
//             () => editor?.value?.viewer,
//             (v) => {
//                 if (v && !trajectoriesLoaded) {
//                     loadTrajectories();
//                     trajectoriesLoaded = true;
//                     stopWatch();
//                 }
//             }
//         );
//     }
// });

function videoVehicle() {
    if (editor?.value && editor.value.viewer) {
        viewer = editor.value.viewer;

        console.log("[RoadVisual] viewer bound");

        flyToInitView();
        connectVehicleSocket();

        viewer.entities.add({
            position: VIDEO_ROUTE_VIEW,
            point: { pixelSize: 6, color: Cesium.Color.RED },
            label: { text: "VIEWER READY" }
        });
    }
}

onMounted(() => {
    console.log("[RoadVisual] mounted");
});

defineExpose({
    loadRoadData,
    loadTrajectories,
    toggleK37Trajectories,
    videoVehicle,
    connectVehicleSocket,
    // 交通态势相关导出
    startTrafficAnimation,
    stopTrafficAnimation,
    pauseTrafficAnimation,
    resumeTrafficAnimation,
    handleTimelineChange
});
</script>

<style scoped>
.road-visualization {
    width: 100%;
    height: 100%;
}

/* 交通态势时间线控制条 */
.trajectory-timeline-control,
.traffic-timeline-control {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    min-width: 400px;
    max-width: 90%;
}

.trajectory-timeline-control {
    bottom: 92px;
}

.timeline-container {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

/* 播放/暂停按钮 */
.play-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.play-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.play-btn:active {
    transform: scale(0.95);
}

/* 进度条容器 */
.progress-container {
    flex: 1;
    min-width: 150px;
}

.timeline-slider {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
    position: relative;
}

/* 进度条轨道 */
.timeline-slider::-webkit-slider-track {
    background: rgba(255, 255, 255, 0.2);
    height: 6px;
    border-radius: 3px;
}

.timeline-slider::-moz-range-track {
    background: rgba(255, 255, 255, 0.2);
    height: 6px;
    border-radius: 3px;
    border: none;
}

/* 进度条滑块 */
.timeline-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
}

.timeline-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.6);
}

.timeline-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
}

.timeline-slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.6);
}

/* 时间戳显示 */
.timestamp-display {
    color: #64d5ff;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    min-width: 150px;
    text-align: center;
    font-family: "Courier New", monospace;
}

/* 进度百分比 */
.progress-percent {
    color: #a0d995;
    font-size: 13px;
    font-weight: 600;
    min-width: 40px;
    text-align: right;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .trajectory-timeline-control,
    .traffic-timeline-control {
        min-width: 320px;
        bottom: 10px;
        padding: 10px 12px;
    }

    .trajectory-timeline-control {
        bottom: 70px;
    }

    .timeline-container {
        gap: 8px;
    }

    .play-btn {
        width: 32px;
        height: 32px;
        font-size: 16px;
    }

    .timestamp-display {
        font-size: 12px;
        min-width: 120px;
    }

    .progress-percent {
        font-size: 12px;
        min-width: 35px;
    }
}

@media (max-width: 480px) {
    .trajectory-timeline-control,
    .traffic-timeline-control {
        min-width: 90%;
        bottom: 10px;
        padding: 8px;
    }

    .trajectory-timeline-control {
        bottom: 58px;
    }

    .timeline-container {
        gap: 6px;
    }

    .timestamp-display {
        display: none;
    }

    .play-btn {
        width: 28px;
        height: 28px;
        font-size: 14px;
    }
}
</style>
