import * as Cesium from "cesium";

const TILESET_URL = "/3DTiles/WGS84/tileset.json";
const OUTPUT_URL = "/data/cpgs84/Simulation/realtime-traffic-150.json";
const LANE_CENTERLINE_URL = "/data/cpgs84/LaneCenterline.geojson";
const ROAD_CENTERLINE_URL = "/data/cpgs84/RoadCenterLine.geojson";
const MODEL_URL = "/SUV_gltf/b03505c6f4f942e5ade70692a899e702.gltf";
const OUTPUT_FILE_NAME = "realtime-traffic-150.json";
const ROUTE_SAMPLE_SPACING_METERS = 3;
const VEHICLE_SAMPLE_INTERVAL_SECONDS = 0.2;
const COLLISION_CHECK_INTERVAL_SECONDS = 0.1;
const BENCHMARK_TIME_SECONDS = 10;
const TRAFFIC_CYCLE_SECONDS = 120;
const LOWER_DECK_RAY_STEP_METERS = 0.5;
const LOWER_DECK_MAX_DEPTH_METERS = 25;
const LOWER_DECK_MAX_RAY_HITS = 4;
const LOWER_DECK_SURFACE_CLUSTER_METERS = 2;
const LOWER_DECK_RAY_BATCH_SIZE = 16;
const ROAD_SURFACE_RAY_ORIGIN_HEIGHT_METERS = 10_000;
const ROAD_SURFACE_RAY_WIDTH_METERS = 0.25;
const ROAD_SURFACE_RAY_BATCH_SIZE = 16;
const ROAD_BOUNDARY_REFINEMENT_STEPS = 5;
const STITCH_CLOSEST_POINT_SEARCH_METERS = 30;
const CONNECTOR_MAX_GRADE = 0.3;
const CONNECTOR_SPIKE_MAX_SEGMENTS = 2;
const CONNECTOR_SPIKE_BLEND_POINTS = 2;
const TRAFFIC_RANDOM_SEED = 20_260_821;
const MAX_ACTIVE_VEHICLE_COUNT = 150;
const MIN_ACTIVE_VEHICLE_COUNT = 80;
const MAX_INGRESS_GAP_SECONDS = 8;

// 修改道路数据、三维模型、车辆规则或JSON结构后，只需修改此标识。
export const TRAFFIC_DATA_REVISION = "traffic-sim-20260823-04";

type LonLat = [number, number];

type GeoJsonFeature = {
    properties: { recordNumber?: number | string };
    geometry: { type: string; coordinates: LonLat[] };
};

type GeoJsonFeatureCollection = {
    features: GeoJsonFeature[];
};

type RoutePoint = {
    longitude: number;
    latitude: number;
    height?: number;
    heightCandidates?: number[];
    heightSource?:
        | "sample-height"
        | "lower-deck-ray"
        | "lower-deck-interpolated";
    distance: number;
};

type SourceSegment = {
    source: "LaneCenterline" | "RoadCenterLine";
    recordNumber: number;
};

type RouteGeometry = {
    id: string;
    routeType: "mainline" | "connector";
    elevationMode: "surface" | "prefer-lower-continuous";
    sourceSegments: SourceSegment[];
    points: RoutePoint[];
};

export type RealtimeTrafficSample = {
    time: number;
    longitude: number;
    latitude: number;
    height: number;
    heightSource?:
        | "sample-height"
        | "lower-deck-ray"
        | "lower-deck-interpolated";
};

export type RealtimeTrafficVehicle = {
    vehicleId: string;
    routeId: string;
    routeType: "mainline" | "connector";
    sourceSegments: SourceSegment[];
    startTime: number;
    endTime: number;
    speedMetersPerSecond: number;
    samples: RealtimeTrafficSample[];
};

export type RealtimeTrafficData = {
    revision: string;
    coordinateSystem: "EPSG:4326";
    generatedAt: string;
    sourceTileset: string;
    model: {
        url: string;
        heightOffsetMeters: number;
        orientationOffsetDegrees: number;
        lengthMeters: number;
        widthMeters: number;
    };
    simulation: {
        durationSeconds: number;
        sampleIntervalSeconds: number;
        benchmarkTimeSeconds: number;
        expectedPeakVehicles: number;
        mainlineVehicles: number;
        connectorVehicles: number;
        continuousLoop: true;
    };
    validation: {
        peakVehicles: number;
        collisionCount: number;
        routesWithSampledHeight: number;
        lowerDeckAdjustedRoutePoints: number;
        maxConnectorGradePercent: number;
        minimumVehicles: number;
        maxIngressGapSeconds: number;
    };
    vehicles: RealtimeTrafficVehicle[];
};

export type RealtimeTrafficStartResult = "started" | "stopped" | "downloaded";

type GenerationProgress = (message: string) => void;

const mainlineRouteDefinitions = [
    { id: "main-east-1", records: [457, 454, 450, 446, 443, 440] },
    { id: "main-east-2", records: [458, 455, 451, 447, 444, 441] },
    { id: "main-east-3", records: [459, 456, 452, 448, 445, 442] },
    {
        id: "main-west-1",
        records: [402, 408, 412, 416, 419, 422, 427, 430]
    },
    {
        id: "main-west-2",
        records: [404, 410, 413, 417, 420, 423, 428, 431]
    },
    {
        id: "main-west-3",
        records: [406, 411, 414, 418, 421, 424, 429, 432]
    }
] as const;

const connectorRouteDefinitions = [23, 24, 25, 26, 27, 28].map((record) => ({
    id: `connector-${record}`,
    records: [record]
}));

function normalizeResourcePath(url: string) {
    try {
        return decodeURIComponent(new URL(url, window.location.href).pathname)
            .replace(/\\/g, "/")
            .toLowerCase();
    } catch {
        return url.replace(/\\/g, "/").toLowerCase();
    }
}

function horizontalDistance(a: LonLat, b: LonLat) {
    const averageLatitude = Cesium.Math.toRadians((a[1] + b[1]) / 2);
    const dx = (b[0] - a[0]) * 111_320 * Math.cos(averageLatitude);
    const dy = (b[1] - a[1]) * 110_540;
    return Math.hypot(dx, dy);
}

function interpolateLonLat(a: LonLat, b: LonLat, ratio: number): LonLat {
    return [
        Cesium.Math.lerp(a[0], b[0], ratio),
        Cesium.Math.lerp(a[1], b[1], ratio)
    ];
}

function resampleLine(coordinates: LonLat[], spacingMeters: number) {
    if (coordinates.length < 2) {
        return [];
    }

    const output: LonLat[] = [[...coordinates[0]] as LonLat];
    let distanceToNextSample = spacingMeters;

    for (let index = 1; index < coordinates.length; index++) {
        let segmentStart = coordinates[index - 1];
        const segmentEnd = coordinates[index];
        let segmentLength = horizontalDistance(segmentStart, segmentEnd);

        while (segmentLength >= distanceToNextSample) {
            const ratio = distanceToNextSample / segmentLength;
            const sample = interpolateLonLat(segmentStart, segmentEnd, ratio);
            output.push(sample);
            segmentStart = sample;
            segmentLength = horizontalDistance(segmentStart, segmentEnd);
            distanceToNextSample = spacingMeters;
        }

        distanceToNextSample -= segmentLength;
    }

    const last = coordinates[coordinates.length - 1];
    if (horizontalDistance(output[output.length - 1], last) > 0.05) {
        output.push([...last] as LonLat);
    }

    return output;
}

function withDistances(
    coordinates: Array<{
        longitude: number;
        latitude: number;
        height?: number;
        heightCandidates?: number[];
        heightSource?:
            | "sample-height"
            | "lower-deck-ray"
            | "lower-deck-interpolated";
    }>
) {
    let distance = 0;
    return coordinates.map((point, index) => {
        if (index > 0) {
            distance += horizontalDistance(
                [
                    coordinates[index - 1].longitude,
                    coordinates[index - 1].latitude
                ],
                [point.longitude, point.latitude]
            );
        }
        return { ...point, distance };
    });
}

function getFeatureMap(collection: GeoJsonFeatureCollection) {
    const map = new Map<number, LonLat[]>();
    for (const feature of collection.features) {
        const recordNumber = Number(feature.properties.recordNumber);
        if (
            Number.isFinite(recordNumber) &&
            feature.geometry.type === "LineString" &&
            Array.isArray(feature.geometry.coordinates)
        ) {
            map.set(recordNumber, feature.geometry.coordinates);
        }
    }
    return map;
}

function joinRecords(
    records: readonly number[],
    featureMap: Map<number, LonLat[]>
) {
    const joined: LonLat[] = [];

    for (const record of records) {
        const source = featureMap.get(record);
        if (!source || source.length < 2) {
            throw new Error(`缺少道路记录 ${record}`);
        }

        let coordinates = source.map((point) => [...point] as LonLat);
        if (joined.length > 0) {
            const previousEnd = joined[joined.length - 1];
            const distanceToStart = horizontalDistance(
                previousEnd,
                coordinates[0]
            );
            const distanceToEnd = horizontalDistance(
                previousEnd,
                coordinates[coordinates.length - 1]
            );
            if (distanceToEnd < distanceToStart) {
                coordinates = coordinates.reverse();
            }
            const gap = horizontalDistance(previousEnd, coordinates[0]);
            if (gap > 3) {
                throw new Error(
                    `道路记录 ${record} 与前一段存在 ${gap.toFixed(1)} 米间隙`
                );
            }
            coordinates.shift();
        }

        joined.push(...coordinates);
    }

    return joined;
}

function trimLineStartToClosestPoint(line: LonLat[], point: LonLat) {
    let traveledDistance = 0;
    let best:
        | {
              segmentIndex: number;
              ratio: number;
              point: LonLat;
              distance: number;
          }
        | undefined;

    for (
        let index = 0;
        index < line.length - 1 &&
        traveledDistance <= STITCH_CLOSEST_POINT_SEARCH_METERS;
        index++
    ) {
        const start = line[index];
        const end = line[index + 1];
        const averageLatitude = Cesium.Math.toRadians(
            (point[1] + start[1] + end[1]) / 3
        );
        const longitudeScale = 111_320 * Math.cos(averageLatitude);
        const latitudeScale = 110_540;
        const segmentX = (end[0] - start[0]) * longitudeScale;
        const segmentY = (end[1] - start[1]) * latitudeScale;
        const pointX = (point[0] - start[0]) * longitudeScale;
        const pointY = (point[1] - start[1]) * latitudeScale;
        const squaredLength = segmentX ** 2 + segmentY ** 2;
        const ratio =
            squaredLength > 0
                ? Cesium.Math.clamp(
                      (pointX * segmentX + pointY * segmentY) / squaredLength,
                      0,
                      1
                  )
                : 0;
        const projected = interpolateLonLat(start, end, ratio);
        const distance = horizontalDistance(point, projected);
        if (!best || distance < best.distance) {
            best = { segmentIndex: index, ratio, point: projected, distance };
        }
        traveledDistance += horizontalDistance(start, end);
    }

    if (!best) return line;
    const nextIndex = best.ratio >= 0.999 ? best.segmentIndex + 2 : best.segmentIndex + 1;
    return [best.point, ...line.slice(nextIndex)];
}

function stitchCoordinateParts(parts: LonLat[][], maximumGapMeters: number) {
    const joined: LonLat[] = [];
    for (const part of parts) {
        const coordinates = part.map((point) => [...point] as LonLat);
        if (!coordinates.length) continue;
        if (joined.length > 0) {
            const trimmed = trimLineStartToClosestPoint(
                coordinates,
                joined[joined.length - 1]
            );
            coordinates.splice(0, coordinates.length, ...trimmed);
            const gap = horizontalDistance(joined[joined.length - 1], coordinates[0]);
            if (gap > maximumGapMeters) {
                throw new Error(`道路与车道线连接处存在 ${gap.toFixed(1)} 米间隙`);
            }
            if (gap <= 0.05) coordinates.shift();
        }
        joined.push(...coordinates);
    }
    return joined;
}

export function buildRealtimeTrafficRoutes(
    laneCollection: GeoJsonFeatureCollection,
    roadCollection: GeoJsonFeatureCollection
) {
    const laneMap = getFeatureMap(laneCollection);
    const roadMap = getFeatureMap(roadCollection);
    const routes: RouteGeometry[] = [];

    for (const definition of mainlineRouteDefinitions) {
        const coordinates = resampleLine(
            joinRecords(definition.records, laneMap),
            ROUTE_SAMPLE_SPACING_METERS
        );
        routes.push({
            id: definition.id,
            routeType: "mainline",
            elevationMode: "surface",
            sourceSegments: definition.records.map((recordNumber) => ({
                source: "LaneCenterline",
                recordNumber
            })),
            points: withDistances(
                coordinates.map(([longitude, latitude]) => ({
                    longitude,
                    latitude
                }))
            )
        });
    }

    for (const definition of connectorRouteDefinitions) {
        let sourceSegments: SourceSegment[];
        let joinedCoordinates: LonLat[];
        if (definition.records[0] === 23) {
            sourceSegments = [
                { source: "LaneCenterline", recordNumber: 449 },
                { source: "RoadCenterLine", recordNumber: 23 }
            ];
            joinedCoordinates = stitchCoordinateParts(
                [joinRecords([449], laneMap), joinRecords([23], roadMap)],
                8
            );
        } else if (definition.records[0] === 24) {
            sourceSegments = [
                { source: "RoadCenterLine", recordNumber: 24 },
                { source: "LaneCenterline", recordNumber: 415 },
                { source: "LaneCenterline", recordNumber: 412 },
                { source: "LaneCenterline", recordNumber: 408 },
                { source: "LaneCenterline", recordNumber: 402 }
            ];
            joinedCoordinates = stitchCoordinateParts(
                [
                    joinRecords([24], roadMap),
                    joinRecords([402, 408, 412, 415], laneMap).reverse()
                ],
                9
            );
        } else if (definition.records[0] === 27) {
            sourceSegments = [
                { source: "RoadCenterLine", recordNumber: 27 },
                { source: "LaneCenterline", recordNumber: 425 },
                { source: "LaneCenterline", recordNumber: 426 },
                { source: "LaneCenterline", recordNumber: 430 }
            ];
            joinedCoordinates = stitchCoordinateParts(
                [
                    joinRecords([27], roadMap),
                    joinRecords([425, 426, 430], laneMap)
                ],
                14
            );
        } else if (definition.records[0] === 28) {
            sourceSegments = [
                { source: "LaneCenterline", recordNumber: 388 },
                { source: "RoadCenterLine", recordNumber: 28 }
            ];
            joinedCoordinates = stitchCoordinateParts(
                [
                    joinRecords([388], laneMap).reverse(),
                    joinRecords([28], roadMap)
                ],
                8
            );
        } else {
            sourceSegments = definition.records.map((recordNumber) => ({
                source: "RoadCenterLine",
                recordNumber
            }));
            joinedCoordinates = joinRecords(definition.records, roadMap);
        }
        const coordinates = resampleLine(
            joinedCoordinates,
            ROUTE_SAMPLE_SPACING_METERS
        );
        routes.push({
            id: definition.id,
            routeType: "connector",
            elevationMode: "prefer-lower-continuous",
            sourceSegments,
            points: withDistances(
                coordinates.map(([longitude, latitude]) => ({
                    longitude,
                    latitude
                }))
            )
        });
    }

    return routes;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) {
        throw new Error(`加载 ${url} 失败：HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
}

function findTileset(viewer: Cesium.Viewer) {
    const expectedPath = normalizeResourcePath(TILESET_URL);
    for (let index = 0; index < viewer.scene.primitives.length; index++) {
        const primitive = viewer.scene.primitives.get(index);
        const resourceUrl = (primitive as { resource?: { url?: string } })
            .resource?.url;
        if (
            primitive instanceof Cesium.Cesium3DTileset &&
            resourceUrl &&
            normalizeResourcePath(resourceUrl) === expectedPath
        ) {
            return primitive;
        }
    }
    return undefined;
}

async function ensureTileset(viewer: Cesium.Viewer) {
    const existing = findTileset(viewer);
    if (existing) {
        existing.show = true;
        return existing;
    }

    const tileset = await Cesium.Cesium3DTileset.fromUrl(TILESET_URL);
    viewer.scene.primitives.add(tileset);
    return tileset;
}

function fillSmallHeightGaps(points: RoutePoint[]) {
    for (let index = 1; index < points.length - 1; index++) {
        if (Number.isFinite(points[index].height)) continue;

        let end = index;
        while (end < points.length && !Number.isFinite(points[end].height)) {
            end++;
        }
        const gapLength = end - index;
        if (
            gapLength <= 2 &&
            Number.isFinite(points[index - 1].height) &&
            end < points.length &&
            Number.isFinite(points[end].height)
        ) {
            for (let offset = 0; offset < gapLength; offset++) {
                points[index + offset].height = Cesium.Math.lerp(
                    points[index - 1].height!,
                    points[end].height!,
                    (offset + 1) / (gapLength + 1)
                );
            }
        }
        index = end - 1;
    }
}

function getLongestValidHeightRunIndexes(points: RoutePoint[]) {
    let bestStart = -1;
    let bestEnd = -1;
    let runStart = -1;

    for (let index = 0; index <= points.length; index++) {
        const valid =
            index < points.length && Number.isFinite(points[index].height);
        if (valid && runStart < 0) {
            runStart = index;
        }
        if ((!valid || index === points.length) && runStart >= 0) {
            const runEnd = index - 1;
            if (
                bestStart < 0 ||
                points[runEnd].distance - points[runStart].distance >
                    points[bestEnd].distance - points[bestStart].distance
            ) {
                bestStart = runStart;
                bestEnd = runEnd;
            }
            runStart = -1;
        }
    }

    if (bestStart < 0 || bestEnd <= bestStart) {
        return undefined;
    }

    return { start: bestStart, end: bestEnd };
}

function longestValidHeightRun(points: RoutePoint[]) {
    const indexes = getLongestValidHeightRunIndexes(points);
    if (!indexes) return [];

    return withDistances(
        points.slice(indexes.start, indexes.end + 1).map((point) => ({
            longitude: point.longitude,
            latitude: point.latitude,
            height: point.height,
            heightSource: point.heightSource
        }))
    );
}

type MostDetailedRayPickResult = {
    position?: Cesium.Cartesian3;
};

type SceneWithMostDetailedRayPick = Cesium.Scene & {
    pickFromRayMostDetailed: (
        ray: Cesium.Ray,
        objectsToExclude?: object[],
        width?: number
    ) => Promise<MostDetailedRayPickResult | undefined>;
};

async function pickTopTilesetSurfaceHeight(
    viewer: Cesium.Viewer,
    point: Pick<RoutePoint, "longitude" | "latitude">,
    objectsToExclude: object[]
) {
    const scene = viewer.scene as SceneWithMostDetailedRayPick;
    if (typeof scene.pickFromRayMostDetailed !== "function") {
        throw new Error("当前Cesium版本不支持三维道路边界射线拾取");
    }

    const ellipsoid = viewer.scene.globe.ellipsoid;
    const origin = Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        ROAD_SURFACE_RAY_ORIGIN_HEIGHT_METERS
    );
    const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
        origin,
        new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.negate(
        surfaceNormal,
        new Cesium.Cartesian3()
    );
    const result = await scene.pickFromRayMostDetailed(
        new Cesium.Ray(origin, direction),
        objectsToExclude,
        ROAD_SURFACE_RAY_WIDTH_METERS
    );
    if (!result?.position) return undefined;

    const cartographic = Cesium.Cartographic.fromCartesian(
        result.position,
        ellipsoid
    );
    return cartographic && Number.isFinite(cartographic.height)
        ? cartographic.height
        : undefined;
}

async function refineTilesetSurfaceBoundary(
    viewer: Cesium.Viewer,
    outsidePoint: RoutePoint,
    insidePoint: RoutePoint,
    objectsToExclude: object[]
) {
    let outside: RoutePoint = { ...outsidePoint };
    let inside: RoutePoint = { ...insidePoint };

    for (let step = 0; step < ROAD_BOUNDARY_REFINEMENT_STEPS; step++) {
        const middle: RoutePoint = {
            longitude: (outside.longitude + inside.longitude) / 2,
            latitude: (outside.latitude + inside.latitude) / 2,
            distance: 0
        };
        const height = await pickTopTilesetSurfaceHeight(
            viewer,
            middle,
            objectsToExclude
        );
        if (Number.isFinite(height)) {
            middle.height = height;
            middle.heightSource = "sample-height";
            inside = middle;
        } else {
            outside = middle;
        }
    }

    return inside;
}

async function clipRouteToTilesetSurface(
    viewer: Cesium.Viewer,
    route: RouteGeometry,
    objectsToExclude: object[]
) {
    fillSmallHeightGaps(route.points);
    const indexes = getLongestValidHeightRunIndexes(route.points);
    if (!indexes) {
        route.points = [];
        return;
    }

    const clipped = route.points.slice(indexes.start, indexes.end + 1);
    if (
        indexes.start > 0 &&
        !Number.isFinite(route.points[indexes.start - 1].height)
    ) {
        clipped[0] = await refineTilesetSurfaceBoundary(
            viewer,
            route.points[indexes.start - 1],
            route.points[indexes.start],
            objectsToExclude
        );
    }
    if (
        indexes.end < route.points.length - 1 &&
        !Number.isFinite(route.points[indexes.end + 1].height)
    ) {
        clipped[clipped.length - 1] = await refineTilesetSurfaceBoundary(
            viewer,
            route.points[indexes.end + 1],
            route.points[indexes.end],
            objectsToExclude
        );
    }

    clipped.forEach((point) => {
        point.heightSource ??= "sample-height";
    });
    route.points = longestValidHeightRun(clipped);
}

function clusterSurfaceHeights(heights: number[]) {
    const sorted = [...heights].sort((a, b) => b - a);
    const clusters: number[] = [];
    for (const height of sorted) {
        const previous = clusters.at(-1);
        if (
            previous === undefined ||
            previous - height > LOWER_DECK_SURFACE_CLUSTER_METERS
        ) {
            clusters.push(height);
        }
    }
    return clusters;
}

async function collectSurfaceHeightCandidates(
    viewer: Cesium.Viewer,
    point: RoutePoint,
    objectsToExclude: object[]
) {
    const normalHeight = point.height;
    if (!Number.isFinite(normalHeight)) return [];

    const scene = viewer.scene as SceneWithMostDetailedRayPick;
    if (typeof scene.pickFromRayMostDetailed !== "function") {
        throw new Error("当前Cesium版本不支持下层道路射线拾取");
    }

    const ellipsoid = viewer.scene.globe.ellipsoid;
    let origin = Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        normalHeight! - LOWER_DECK_RAY_STEP_METERS
    );
    const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
        origin,
        new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.negate(
        surfaceNormal,
        new Cesium.Cartesian3()
    );
    const heights = [normalHeight!];

    for (let hitIndex = 0; hitIndex < LOWER_DECK_MAX_RAY_HITS; hitIndex++) {
        const result = await scene.pickFromRayMostDetailed(
            new Cesium.Ray(origin, direction),
            objectsToExclude,
            0.25
        );
        if (!result?.position) break;

        const cartographic = Cesium.Cartographic.fromCartesian(
            result.position,
            ellipsoid
        );
        if (!cartographic || !Number.isFinite(cartographic.height)) break;
        if (normalHeight! - cartographic.height > LOWER_DECK_MAX_DEPTH_METERS) {
            break;
        }
        heights.push(cartographic.height);
        origin = Cesium.Cartesian3.add(
            result.position,
            Cesium.Cartesian3.multiplyByScalar(
                direction,
                LOWER_DECK_RAY_STEP_METERS,
                new Cesium.Cartesian3()
            ),
            new Cesium.Cartesian3()
        );
    }

    return clusterSurfaceHeights(heights);
}

function fillSmallLowerDeckCandidateGaps(route: RouteGeometry) {
    for (let index = 1; index < route.points.length - 1; index++) {
        if ((route.points[index].heightCandidates?.length ?? 0) > 1) continue;

        let end = index;
        while (
            end < route.points.length &&
            (route.points[end].heightCandidates?.length ?? 0) <= 1
        ) {
            end++;
        }
        const gapLength = end - index;
        const before = route.points[index - 1].heightCandidates;
        const after = route.points[end]?.heightCandidates;
        if (
            gapLength <= 2 &&
            before &&
            before.length > 1 &&
            after &&
            after.length > 1
        ) {
            for (let offset = 0; offset < gapLength; offset++) {
                const point = route.points[index + offset];
                const lowerHeight = Cesium.Math.lerp(
                    before[1],
                    after![1],
                    (offset + 1) / (gapLength + 1)
                );
                point.heightCandidates = [point.height!, lowerHeight];
            }
        }
        index = end - 1;
    }
}

async function sampleLowerDeckCandidates(
    viewer: Cesium.Viewer,
    routes: RouteGeometry[],
    objectsToExclude: object[],
    onProgress: GenerationProgress
) {
    const connectorPoints = routes
        .filter((route) => route.elevationMode === "prefer-lower-continuous")
        .flatMap((route) => route.points);

    for (
        let start = 0;
        start < connectorPoints.length;
        start += LOWER_DECK_RAY_BATCH_SIZE
    ) {
        const batch = connectorPoints.slice(
            start,
            start + LOWER_DECK_RAY_BATCH_SIZE
        );
        const candidates = await Promise.all(
            batch.map((point) =>
                collectSurfaceHeightCandidates(viewer, point, objectsToExclude)
            )
        );
        candidates.forEach((heights, index) => {
            batch[index].heightCandidates = heights.length
                ? heights
                : [batch[index].height!];
        });
        onProgress(
            `下层道路多表面采样 ${Math.min(
                start + batch.length,
                connectorPoints.length
            )}/${connectorPoints.length}`
        );
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    routes
        .filter((route) => route.elevationMode === "prefer-lower-continuous")
        .forEach(fillSmallLowerDeckCandidateGaps);
}

function selectContinuousLowerDeckHeights(route: RouteGeometry) {
    const candidateSets = route.points.map((point) =>
        point.heightCandidates?.length
            ? point.heightCandidates
            : [point.height!]
    );
    const costs: number[][] = [];
    const previousIndexes: number[][] = [];

    for (let pointIndex = 0; pointIndex < route.points.length; pointIndex++) {
        const candidates = candidateSets[pointIndex];
        costs[pointIndex] = candidates.map(() => Number.POSITIVE_INFINITY);
        previousIndexes[pointIndex] = candidates.map(() => -1);

        for (
            let candidateIndex = 0;
            candidateIndex < candidates.length;
            candidateIndex++
        ) {
            const layerPenalty =
                candidates.length <= 1
                    ? 0
                    : candidateIndex === 1
                      ? 0
                      : candidateIndex === 0
                        ? 8
                        : 20 + candidateIndex * 5;
            if (pointIndex === 0) {
                costs[pointIndex][candidateIndex] = layerPenalty;
                continue;
            }

            const segmentLength = Math.max(
                route.points[pointIndex].distance -
                    route.points[pointIndex - 1].distance,
                0.5
            );
            const previousCandidates = candidateSets[pointIndex - 1];
            for (
                let previousIndex = 0;
                previousIndex < previousCandidates.length;
                previousIndex++
            ) {
                const grade =
                    Math.abs(
                        candidates[candidateIndex] -
                            previousCandidates[previousIndex]
                    ) / segmentLength;
                const excessiveGradePenalty =
                    grade > 0.25 ? 10_000 * (grade - 0.25) ** 2 : 0;
                const transitionCost =
                    costs[pointIndex - 1][previousIndex] +
                    grade ** 2 * 200 +
                    excessiveGradePenalty +
                    layerPenalty;
                if (transitionCost < costs[pointIndex][candidateIndex]) {
                    costs[pointIndex][candidateIndex] = transitionCost;
                    previousIndexes[pointIndex][candidateIndex] = previousIndex;
                }
            }
        }
    }

    let selectedIndex = costs
        .at(-1)!
        .reduce(
            (best, cost, index, all) => (cost < all[best] ? index : best),
            0
        );
    for (
        let pointIndex = route.points.length - 1;
        pointIndex >= 0;
        pointIndex--
    ) {
        const point = route.points[pointIndex];
        const selectedHeight = candidateSets[pointIndex][selectedIndex];
        if (Math.abs(selectedHeight - point.height!) > 0.5) {
            point.height = selectedHeight;
            point.heightSource = "lower-deck-ray";
        } else {
            point.heightSource = "sample-height";
        }
        selectedIndex = previousIndexes[pointIndex][selectedIndex];
        if (pointIndex > 0 && selectedIndex < 0) {
            throw new Error(`${route.id} 的下层道路高程路径无法连续回溯`);
        }
    }
}

function repairShortConnectorHeightSpikes(route: RouteGeometry) {
    const steepSegments: number[] = [];
    for (let index = 1; index < route.points.length; index++) {
        const distance = Math.max(
            route.points[index].distance - route.points[index - 1].distance,
            0.5
        );
        const grade =
            Math.abs(
                route.points[index].height! - route.points[index - 1].height!
            ) / distance;
        if (grade > CONNECTOR_MAX_GRADE) steepSegments.push(index);
    }

    const runs: number[][] = [];
    for (const segmentIndex of steepSegments) {
        const lastRun = runs.at(-1);
        if (lastRun && segmentIndex === lastRun[lastRun.length - 1] + 1) {
            lastRun.push(segmentIndex);
        } else {
            runs.push([segmentIndex]);
        }
    }

    let repairedPoints = 0;
    for (const run of runs) {
        if (run.length > CONNECTOR_SPIKE_MAX_SEGMENTS) continue;

        const startIndex = Math.max(0, run[0] - CONNECTOR_SPIKE_BLEND_POINTS);
        const endIndex = Math.min(
            route.points.length - 1,
            run[run.length - 1] + CONNECTOR_SPIKE_BLEND_POINTS
        );
        const start = route.points[startIndex];
        const end = route.points[endIndex];
        const span = end.distance - start.distance;
        if (span <= 0) continue;

        for (let index = startIndex + 1; index < endIndex; index++) {
            const point = route.points[index];
            const ratio = (point.distance - start.distance) / span;
            point.height = Cesium.Math.lerp(start.height!, end.height!, ratio);
            point.heightSource = "lower-deck-interpolated";
            repairedPoints++;
        }
    }
    return repairedPoints;
}

function getConnectorHeightValidation(routes: RouteGeometry[]) {
    let adjustedPoints = 0;
    let maxGrade = 0;
    let maxGradeRouteId = "";
    for (const route of routes.filter(
        (item) => item.routeType === "connector"
    )) {
        adjustedPoints += route.points.filter(
            (point) => point.heightSource !== "sample-height"
        ).length;
        for (let index = 1; index < route.points.length; index++) {
            const distance = Math.max(
                route.points[index].distance - route.points[index - 1].distance,
                0.5
            );
            const grade =
                Math.abs(
                    route.points[index].height! -
                        route.points[index - 1].height!
                ) / distance;
            if (grade > maxGrade) {
                maxGrade = grade;
                maxGradeRouteId = route.id;
            }
        }
    }

    if (adjustedPoints === 0) {
        throw new Error("未识别到任何下层道路高度，请检查双层道路射线拾取结果");
    }
    if (maxGrade > CONNECTOR_MAX_GRADE) {
        throw new Error(
            `${maxGradeRouteId} 的下层道路修正后最大纵坡仍达到 ${(
                maxGrade * 100
            ).toFixed(1)}%，已停止生成JSON`
        );
    }
    return {
        lowerDeckAdjustedRoutePoints: adjustedPoints,
        maxConnectorGradePercent: Number((maxGrade * 100).toFixed(2))
    };
}

async function sampleRouteHeights(
    viewer: Cesium.Viewer,
    tileset: Cesium.Cesium3DTileset,
    routes: RouteGeometry[],
    onProgress: GenerationProgress
) {
    if (!viewer.scene.sampleHeightSupported) {
        throw new Error("当前浏览器不支持三维场景高度采样");
    }

    const flatPoints = routes.flatMap((route) => route.points);
    const excludedObjects: object[] = [];
    for (let index = 0; index < viewer.scene.primitives.length; index++) {
        const primitive = viewer.scene.primitives.get(index);
        if (primitive !== tileset) {
            excludedObjects.push(primitive);
        }
    }

    const originalGlobeShow = viewer.scene.globe.show;
    const originalTilesetShow = tileset.show;
    viewer.scene.globe.show = false;
    tileset.show = true;

    let lowerDeckValidation:
        | {
              lowerDeckAdjustedRoutePoints: number;
              maxConnectorGradePercent: number;
          }
        | undefined;
    try {
        for (
            let start = 0;
            start < flatPoints.length;
            start += ROAD_SURFACE_RAY_BATCH_SIZE
        ) {
            const batch = flatPoints.slice(
                start,
                start + ROAD_SURFACE_RAY_BATCH_SIZE
            );
            const heights = await Promise.all(
                batch.map((point) =>
                    pickTopTilesetSurfaceHeight(
                        viewer,
                        point,
                        excludedObjects
                    )
                )
            );
            heights.forEach((height, index) => {
                if (Number.isFinite(height)) {
                    batch[index].height = height;
                    batch[index].heightSource = "sample-height";
                }
            });
            onProgress(
                `道路模型边界与高度采样 ${Math.min(start + batch.length, flatPoints.length)}/${flatPoints.length}`
            );
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }

        const invalidRoutes: string[] = [];
        for (const route of routes) {
            await clipRouteToTilesetSurface(viewer, route, excludedObjects);
            const routeLength = route.points.at(-1)?.distance ?? 0;
            if (route.points.length < 2 || routeLength < 30) {
                invalidRoutes.push(route.id);
            }
        }

        if (invalidRoutes.length > 0) {
            throw new Error(
                `以下路线未能从道路模型取得至少30米连续高度：${invalidRoutes.join(
                    "、"
                )}`
            );
        }

        await sampleLowerDeckCandidates(
            viewer,
            routes,
            excludedObjects,
            onProgress
        );
        routes
            .filter(
                (route) => route.elevationMode === "prefer-lower-continuous"
            )
            .forEach((route) => {
                selectContinuousLowerDeckHeights(route);
                repairShortConnectorHeightSpikes(route);
            });
        lowerDeckValidation = getConnectorHeightValidation(routes);
    } finally {
        viewer.scene.globe.show = originalGlobeShow;
        tileset.show = originalTilesetShow;
    }

    if (!lowerDeckValidation) {
        throw new Error("下层道路高度校验未完成");
    }
    return lowerDeckValidation;
}

function sampleRouteAtDistance(route: RouteGeometry, distance: number) {
    const points = route.points;
    const clamped = Cesium.Math.clamp(
        distance,
        0,
        points[points.length - 1].distance
    );
    let low = 0;
    let high = points.length - 1;
    while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (points[middle].distance <= clamped) low = middle;
        else high = middle;
    }

    const start = points[low];
    const end = points[Math.min(low + 1, points.length - 1)];
    const segmentLength = end.distance - start.distance;
    const ratio =
        segmentLength > 0 ? (clamped - start.distance) / segmentLength : 0;
    return {
        longitude: Cesium.Math.lerp(start.longitude, end.longitude, ratio),
        latitude: Cesium.Math.lerp(start.latitude, end.latitude, ratio),
        height: Cesium.Math.lerp(start.height!, end.height!, ratio),
        heightSource:
            start.heightSource === "lower-deck-interpolated" ||
            end.heightSource === "lower-deck-interpolated"
                ? ("lower-deck-interpolated" as const)
                : start.heightSource === "lower-deck-ray" ||
                    end.heightSource === "lower-deck-ray"
                  ? ("lower-deck-ray" as const)
                  : ("sample-height" as const)
    };
}

function reverseRoute(route: RouteGeometry): RouteGeometry {
    return {
        ...route,
        sourceSegments: [...route.sourceSegments].reverse(),
        points: withDistances(
            [...route.points].reverse().map((point) => ({
                longitude: point.longitude,
                latitude: point.latitude,
                height: point.height,
                heightSource: point.heightSource
            }))
        )
    };
}

function createVehicle(
    vehicleId: string,
    route: RouteGeometry,
    startTime: number,
    speedMetersPerSecond: number,
    speedPhase = 0,
    speedVariation = 0
): RealtimeTrafficVehicle {
    const routeLength = route.points[route.points.length - 1].distance;
    const samples: RealtimeTrafficSample[] = [];
    let elapsed = 0;
    let distance = 0;
    let currentSpeed = speedMetersPerSecond;

    while (distance < routeLength) {
        const point = sampleRouteAtDistance(route, distance);
        samples.push({
            time: Number((startTime + elapsed).toFixed(3)),
            longitude: point.longitude,
            latitude: point.latitude,
            height: point.height,
            heightSource: point.heightSource
        });

        const targetSpeed =
            speedMetersPerSecond +
            Math.sin(elapsed * 0.31 + speedPhase) * speedVariation +
            Math.sin(elapsed * 0.11 + speedPhase * 1.7) * speedVariation * 0.35;
        const maximumAcceleration = 0.7 * VEHICLE_SAMPLE_INTERVAL_SECONDS;
        const maximumDeceleration = 0.9 * VEHICLE_SAMPLE_INTERVAL_SECONDS;
        currentSpeed += Cesium.Math.clamp(
            targetSpeed - currentSpeed,
            -maximumDeceleration,
            maximumAcceleration
        );
        currentSpeed = Math.max(currentSpeed, 3);

        const nextDistance =
            distance + currentSpeed * VEHICLE_SAMPLE_INTERVAL_SECONDS;
        if (nextDistance >= routeLength) {
            elapsed += (routeLength - distance) / currentSpeed;
            distance = routeLength;
            break;
        }
        distance = nextDistance;
        elapsed += VEHICLE_SAMPLE_INTERVAL_SECONDS;
    }

    const finalPoint = sampleRouteAtDistance(route, routeLength);
    let endTime = Number((startTime + elapsed).toFixed(3));
    const finalSample: RealtimeTrafficSample = {
        time: endTime,
        longitude: finalPoint.longitude,
        latitude: finalPoint.latitude,
        height: finalPoint.height,
        heightSource: finalPoint.heightSource
    };
    if (endTime <= samples.at(-1)!.time) {
        endTime = samples.at(-1)!.time;
        finalSample.time = endTime;
        samples[samples.length - 1] = finalSample;
    } else {
        samples.push(finalSample);
    }

    return {
        vehicleId,
        routeId: route.id,
        routeType: route.routeType,
        sourceSegments: route.sourceSegments,
        startTime: Number(startTime.toFixed(3)),
        endTime,
        speedMetersPerSecond,
        samples
    };
}

type VehiclePose = {
    x: number;
    y: number;
    z: number;
    headingX: number;
    headingY: number;
};

function sampleVehiclePose(vehicle: RealtimeTrafficVehicle, time: number) {
    if (time < vehicle.startTime || time > vehicle.endTime) return undefined;
    const samples = vehicle.samples;
    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (samples[middle].time <= time) low = middle;
        else high = middle;
    }
    const a = samples[low];
    const b = samples[Math.min(low + 1, samples.length - 1)];
    const timeSpan = b.time - a.time;
    const ratio = timeSpan > 0 ? (time - a.time) / timeSpan : 0;
    const longitude = Cesium.Math.lerp(a.longitude, b.longitude, ratio);
    const latitude = Cesium.Math.lerp(a.latitude, b.latitude, ratio);
    const height = Cesium.Math.lerp(a.height, b.height, ratio);
    const referenceLatitude = Cesium.Math.toRadians(40.399);
    const x = longitude * 111_320 * Math.cos(referenceLatitude);
    const y = latitude * 110_540;
    const bx = b.longitude * 111_320 * Math.cos(referenceLatitude);
    const by = b.latitude * 110_540;
    const ax = a.longitude * 111_320 * Math.cos(referenceLatitude);
    const ay = a.latitude * 110_540;
    const magnitude = Math.hypot(bx - ax, by - ay) || 1;
    return {
        x,
        y,
        z: height,
        headingX: (bx - ax) / magnitude,
        headingY: (by - ay) / magnitude
    } satisfies VehiclePose;
}

function projectionsOverlap(
    centerDeltaX: number,
    centerDeltaY: number,
    axisX: number,
    axisY: number,
    first: VehiclePose,
    second: VehiclePose,
    halfLength: number,
    halfWidth: number
) {
    const distance = Math.abs(centerDeltaX * axisX + centerDeltaY * axisY);
    const firstSideX = -first.headingY;
    const firstSideY = first.headingX;
    const secondSideX = -second.headingY;
    const secondSideY = second.headingX;
    const firstRadius =
        halfLength * Math.abs(first.headingX * axisX + first.headingY * axisY) +
        halfWidth * Math.abs(firstSideX * axisX + firstSideY * axisY);
    const secondRadius =
        halfLength *
            Math.abs(second.headingX * axisX + second.headingY * axisY) +
        halfWidth * Math.abs(secondSideX * axisX + secondSideY * axisY);
    return distance < firstRadius + secondRadius;
}

function posesOverlap(first: VehiclePose, second: VehiclePose) {
    if (Math.abs(first.z - second.z) >= 2.5) return false;

    const halfLength = 2.9;
    const halfWidth = 1.15;
    const deltaX = second.x - first.x;
    const deltaY = second.y - first.y;
    const axes: Array<[number, number]> = [
        [first.headingX, first.headingY],
        [-first.headingY, first.headingX],
        [second.headingX, second.headingY],
        [-second.headingY, second.headingX]
    ];
    return axes.every(([axisX, axisY]) =>
        projectionsOverlap(
            deltaX,
            deltaY,
            axisX,
            axisY,
            first,
            second,
            halfLength,
            halfWidth
        )
    );
}

function vehiclesCollide(
    first: RealtimeTrafficVehicle,
    second: RealtimeTrafficVehicle,
    secondTimeOffset = 0
) {
    const start = Math.max(
        first.startTime,
        second.startTime + secondTimeOffset
    );
    const stop = Math.min(first.endTime, second.endTime + secondTimeOffset);
    if (stop <= start) return false;

    for (
        let time = start;
        time <= stop;
        time += COLLISION_CHECK_INTERVAL_SECONDS
    ) {
        const firstPose = sampleVehiclePose(first, time);
        const secondPose = sampleVehiclePose(second, time - secondTimeOffset);
        if (firstPose && secondPose && posesOverlap(firstPose, secondPose)) {
            return true;
        }
    }
    return false;
}

function collidesWithAny(
    candidate: RealtimeTrafficVehicle,
    vehicles: RealtimeTrafficVehicle[]
) {
    return vehicles.some((vehicle) =>
        [-TRAFFIC_CYCLE_SECONDS, 0, TRAFFIC_CYCLE_SECONDS].some((offset) =>
            vehiclesCollide(candidate, vehicle, offset)
        )
    );
}

function isActiveAtCycleTime(
    vehicle: RealtimeTrafficVehicle,
    cycleTime: number
) {
    return [
        cycleTime - TRAFFIC_CYCLE_SECONDS,
        cycleTime,
        cycleTime + TRAFFIC_CYCLE_SECONDS
    ].some(
        (sampleTime) =>
            sampleTime >= vehicle.startTime && sampleTime <= vehicle.endTime
    );
}

function wouldExceedActiveVehicleLimit(
    candidate: RealtimeTrafficVehicle,
    vehicles: RealtimeTrafficVehicle[]
) {
    for (
        let time = 0;
        time < TRAFFIC_CYCLE_SECONDS;
        time += VEHICLE_SAMPLE_INTERVAL_SECONDS
    ) {
        if (!isActiveAtCycleTime(candidate, time)) continue;
        const activeVehicles = vehicles.filter((vehicle) =>
            isActiveAtCycleTime(vehicle, time)
        ).length;
        if (activeVehicles >= MAX_ACTIVE_VEHICLE_COUNT) return true;
    }
    return false;
}

export function scheduleRealtimeTrafficVehicles(routes: RouteGeometry[]) {
    const mainlineRoutes = routes.filter(
        (route) => route.routeType === "mainline"
    );
    const connectorRoutes = routes.filter(
        (route) => route.routeType === "connector"
    );
    const vehicles: RealtimeTrafficVehicle[] = [];
    const random = createSeededRandom(TRAFFIC_RANDOM_SEED);
    const mainlineTargetActiveCounts = [22, 22, 22, 22, 22, 21];
    const connectorTargetActiveCounts: Record<number, number> = {
        23: 7,
        24: 7,
        27: 7,
        28: 9
    };

    function scheduleStream(
        route: RouteGeometry,
        vehicleIdPrefix: string,
        targetActiveVehicles: number,
        baseSpeed: number,
        speedVariation: number,
        searchEntireCycle = false
    ) {
        const nominalDuration = createVehicle(
            "preview",
            route,
            0,
            baseSpeed
        ).endTime;
        const nominalHeadway = nominalDuration / targetActiveVehicles;
        let plannedStart = random() * nominalHeadway;
        let vehicleIndex = 1;

        while (plannedStart < TRAFFIC_CYCLE_SECONDS) {
            const speed = baseSpeed + (random() - 0.5) * 0.5;
            const speedPhase = random() * Math.PI * 2;
            let scheduled: RealtimeTrafficVehicle | undefined;

            const maximumAttempts = searchEntireCycle
                ? Math.ceil(
                      TRAFFIC_CYCLE_SECONDS /
                          VEHICLE_SAMPLE_INTERVAL_SECONDS
                  )
                : 20;
            for (let attempt = 0; attempt < maximumAttempts; attempt++) {
                const delayedStart = plannedStart + attempt * 0.2;
                const candidateStart = searchEntireCycle
                    ? delayedStart % TRAFFIC_CYCLE_SECONDS
                    : delayedStart;
                if (!searchEntireCycle && candidateStart >= TRAFFIC_CYCLE_SECONDS) {
                    break;
                }
                const candidate = createVehicle(
                    `${vehicleIdPrefix}-${vehicleIndex}`,
                    route,
                    candidateStart,
                    speed - Math.floor(attempt / 5) * 0.08,
                    speedPhase,
                    speedVariation
                );
                if (
                    !collidesWithAny(candidate, vehicles) &&
                    !wouldExceedActiveVehicleLimit(candidate, vehicles)
                ) {
                    scheduled = candidate;
                    break;
                }
            }

            if (scheduled) {
                vehicles.push(scheduled);
                vehicleIndex++;
            }
            plannedStart += nominalHeadway * (0.82 + random() * 0.36);
        }
    }

    connectorRoutes.forEach((sourceRoute) => {
        const recordNumber = sourceRoute.sourceSegments.find(
            (segment) => segment.source === "RoadCenterLine"
        )!.recordNumber;
        if (recordNumber === 25 || recordNumber === 26) return;
        const route =
            recordNumber === 24 || recordNumber === 28
                ? reverseRoute(sourceRoute)
                : sourceRoute;
        scheduleStream(
            route,
            `connector-${recordNumber}`,
            connectorTargetActiveCounts[recordNumber] ?? 1,
            6.2 + random() * 1.3,
            0.4,
            true
        );

        if (
            !vehicles.some(
                (vehicle) => vehicle.vehicleId === `connector-${recordNumber}-1`
            )
        ) {
            throw new Error(
                `连接线车辆无法按固定方向调度：connector-${recordNumber}`
            );
        }
    });

    mainlineRoutes.forEach((route, routeIndex) => {
        scheduleStream(
            route,
            `main-${routeIndex + 1}`,
            mainlineTargetActiveCounts[routeIndex],
            11.8 + (routeIndex % 3) * 0.75 + random() * 0.45,
            0.55
        );
    });

    return vehicles;
}

function createSeededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

export function validateRealtimeTrafficVehicles(
    vehicles: RealtimeTrafficVehicle[]
) {
    if (vehicles.length < MAX_ACTIVE_VEHICLE_COUNT) {
        throw new Error(`循环车流事件数量不足，实际为${vehicles.length}`);
    }

    for (const vehicle of vehicles) {
        if (vehicle.samples.length < 2) {
            throw new Error(`${vehicle.vehicleId} 缺少有效轨迹点`);
        }
        for (let index = 0; index < vehicle.samples.length; index++) {
            const sample = vehicle.samples[index];
            if (
                !Number.isFinite(sample.longitude) ||
                !Number.isFinite(sample.latitude) ||
                !Number.isFinite(sample.height)
            ) {
                throw new Error(`${vehicle.vehicleId} 存在无效坐标或高度`);
            }
            if (index > 0 && sample.time <= vehicle.samples[index - 1].time) {
                throw new Error(`${vehicle.vehicleId} 的采样时间未严格递增`);
            }
        }
    }

    let collisionCount = 0;
    for (let first = 0; first < vehicles.length; first++) {
        for (let second = first + 1; second < vehicles.length; second++) {
            if (
                [-TRAFFIC_CYCLE_SECONDS, 0, TRAFFIC_CYCLE_SECONDS].some(
                    (offset) =>
                        vehiclesCollide(
                            vehicles[first],
                            vehicles[second],
                            offset
                        )
                )
            ) {
                collisionCount++;
            }
        }
    }
    if (collisionCount > 0) {
        throw new Error(`轨迹校验发现 ${collisionCount} 组车辆重叠`);
    }

    let peakVehicles = 0;
    let minimumVehicles = Number.POSITIVE_INFINITY;
    for (
        let time = 0;
        time < TRAFFIC_CYCLE_SECONDS;
        time += VEHICLE_SAMPLE_INTERVAL_SECONDS
    ) {
        const activeVehicles = vehicles.filter((vehicle) =>
            isActiveAtCycleTime(vehicle, time)
        ).length;
        peakVehicles = Math.max(peakVehicles, activeVehicles);
        minimumVehicles = Math.min(minimumVehicles, activeVehicles);
    }
    if (peakVehicles > MAX_ACTIVE_VEHICLE_COUNT) {
        throw new Error(
            `循环车流峰值不得超过${MAX_ACTIVE_VEHICLE_COUNT}辆，实际为${peakVehicles}`
        );
    }
    if (minimumVehicles < MIN_ACTIVE_VEHICLE_COUNT) {
        throw new Error(
            `循环车流最低仅${minimumVehicles}辆，未达到持续车流要求`
        );
    }

    const startTimes = vehicles
        .map((vehicle) => vehicle.startTime)
        .sort((a, b) => a - b);
    let maxIngressGapSeconds = 0;
    for (let index = 1; index < startTimes.length; index++) {
        maxIngressGapSeconds = Math.max(
            maxIngressGapSeconds,
            startTimes[index] - startTimes[index - 1]
        );
    }
    maxIngressGapSeconds = Math.max(
        maxIngressGapSeconds,
        startTimes[0] + TRAFFIC_CYCLE_SECONDS - startTimes.at(-1)!
    );
    if (maxIngressGapSeconds > MAX_INGRESS_GAP_SECONDS) {
        throw new Error(
            `循环中最长${maxIngressGapSeconds.toFixed(1)}秒没有新车驶入`
        );
    }

    return {
        peakVehicles,
        minimumVehicles,
        maxIngressGapSeconds: Number(maxIngressGapSeconds.toFixed(2)),
        collisionCount
    };
}

function downloadJson(data: RealtimeTrafficData) {
    const blobUrl = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json;charset=utf-8"
        })
    );
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = OUTPUT_FILE_NAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

async function generateTrafficData(
    viewer: Cesium.Viewer,
    tileset: Cesium.Cesium3DTileset,
    onProgress: GenerationProgress
) {
    onProgress("正在读取车道线和道路中心线");
    const [laneCollection, roadCollection] = await Promise.all([
        fetchJson<GeoJsonFeatureCollection>(LANE_CENTERLINE_URL),
        fetchJson<GeoJsonFeatureCollection>(ROAD_CENTERLINE_URL)
    ]);
    const routes = buildRealtimeTrafficRoutes(laneCollection, roadCollection);
    onProgress(`已生成 ${routes.length} 条路线，准备采样道路高度`);
    const lowerDeckValidation = await sampleRouteHeights(
        viewer,
        tileset,
        routes,
        onProgress
    );
    onProgress("正在生成非均匀车流并校验150辆车的安全间距");
    const vehicles = scheduleRealtimeTrafficVehicles(routes);
    const validation = validateRealtimeTrafficVehicles(vehicles);
    const mainlineVehicles = vehicles.filter(
        (vehicle) => vehicle.routeType === "mainline"
    ).length;
    const connectorVehicles = vehicles.length - mainlineVehicles;

    return {
        revision: TRAFFIC_DATA_REVISION,
        coordinateSystem: "EPSG:4326",
        generatedAt: new Date().toISOString(),
        sourceTileset: TILESET_URL,
        model: {
            url: MODEL_URL,
            heightOffsetMeters: 0.1,
            orientationOffsetDegrees: -90,
            lengthMeters: 4.8,
            widthMeters: 1.9
        },
        simulation: {
            durationSeconds: TRAFFIC_CYCLE_SECONDS,
            sampleIntervalSeconds: VEHICLE_SAMPLE_INTERVAL_SECONDS,
            benchmarkTimeSeconds: BENCHMARK_TIME_SECONDS,
            expectedPeakVehicles: MAX_ACTIVE_VEHICLE_COUNT,
            mainlineVehicles,
            connectorVehicles,
            continuousLoop: true
        },
        validation: {
            ...validation,
            routesWithSampledHeight: routes.length,
            ...lowerDeckValidation
        },
        vehicles
    } satisfies RealtimeTrafficData;
}

async function tryLoadTrafficData() {
    const response = await fetch(`${OUTPUT_URL}?t=${Date.now()}`, {
        cache: "no-store"
    });
    if (response.status === 404) return undefined;
    if (!response.ok) {
        throw new Error(`加载实时交通JSON失败：HTTP ${response.status}`);
    }
    const text = await response.text();
    try {
        const data = JSON.parse(text) as Partial<RealtimeTrafficData>;
        return data.revision === TRAFFIC_DATA_REVISION
            ? (data as RealtimeTrafficData)
            : undefined;
    } catch {
        if (text.trimStart().startsWith("<")) return undefined;
        throw new Error("实时交通JSON格式错误");
    }
}

type RuntimeVehicle = {
    data: RealtimeTrafficVehicle;
    entity: Cesium.Entity;
    sampledPosition: Cesium.SampledPositionProperty;
    sampledOrientation: Cesium.VelocityOrientationProperty;
    position: Cesium.ConstantPositionProperty;
    orientation: Cesium.ConstantProperty;
};

export class RealtimeTrafficSimulation {
    private viewer: Cesium.Viewer;
    private onProgress: GenerationProgress;
    private dataSource?: Cesium.CustomDataSource;
    private vehicles: RuntimeVehicle[] = [];
    private removeUpdateListener?: () => void;
    private animationStartedAt = 0;
    private data?: RealtimeTrafficData;
    private busy = false;

    constructor(viewer: Cesium.Viewer, onProgress: GenerationProgress) {
        this.viewer = viewer;
        this.onProgress = onProgress;
    }

    get isRunning() {
        return Boolean(this.removeUpdateListener);
    }

    async toggle(): Promise<RealtimeTrafficStartResult> {
        if (this.isRunning) {
            this.stop();
            return "stopped";
        }
        if (this.busy) {
            throw new Error("实时交通数据正在处理中，请稍候");
        }

        this.busy = true;
        try {
            const tileset = await ensureTileset(this.viewer);
            const data = await tryLoadTrafficData();
            if (!data) {
                const generated = await generateTrafficData(
                    this.viewer,
                    tileset,
                    this.onProgress
                );
                downloadJson(generated);
                return "downloaded";
            }
            this.start(data);
            return "started";
        } finally {
            this.busy = false;
        }
    }

    stop() {
        this.removeUpdateListener?.();
        this.removeUpdateListener = undefined;
        if (this.dataSource) {
            this.viewer.dataSources.remove(this.dataSource, true);
            this.dataSource = undefined;
        }
        this.vehicles = [];
        this.data = undefined;
    }

    private start(data: RealtimeTrafficData) {
        validateRealtimeTrafficVehicles(data.vehicles);
        this.stop();
        this.data = data;
        this.dataSource = new Cesium.CustomDataSource(
            "realtime-traffic-simulation"
        );
        this.viewer.dataSources.add(this.dataSource);
        const epoch = Cesium.JulianDate.now();
        const orientationFix = Cesium.Quaternion.fromAxisAngle(
            Cesium.Cartesian3.UNIT_Z,
            Cesium.Math.toRadians(data.model.orientationOffsetDegrees)
        );

        this.vehicles = data.vehicles.map((vehicle) => {
            const sampledPosition = new Cesium.SampledPositionProperty();
            for (const sample of vehicle.samples) {
                sampledPosition.addSample(
                    Cesium.JulianDate.addSeconds(
                        epoch,
                        sample.time,
                        new Cesium.JulianDate()
                    ),
                    Cesium.Cartesian3.fromDegrees(
                        sample.longitude,
                        sample.latitude,
                        sample.height + data.model.heightOffsetMeters
                    )
                );
            }
            sampledPosition.setInterpolationOptions({
                interpolationAlgorithm: Cesium.LinearApproximation,
                interpolationDegree: 1
            });
            const sampledOrientation = new Cesium.VelocityOrientationProperty(
                sampledPosition
            );
            const firstPosition = sampledPosition.getValue(
                Cesium.JulianDate.addSeconds(
                    epoch,
                    vehicle.startTime,
                    new Cesium.JulianDate()
                )
            )!;
            const position = new Cesium.ConstantPositionProperty(firstPosition);
            const orientation = new Cesium.ConstantProperty(
                Cesium.Quaternion.IDENTITY
            );
            const entity = this.dataSource!.entities.add({
                id: `realtime-${vehicle.vehicleId}`,
                name: vehicle.vehicleId,
                show: false,
                position,
                orientation,
                model: {
                    uri: data.model.url,
                    heightReference: Cesium.HeightReference.NONE,
                    minimumPixelSize: 32,
                    maximumScale: 15
                }
            });
            return {
                data: vehicle,
                entity,
                sampledPosition,
                sampledOrientation,
                position,
                orientation
            };
        });

        this.animationStartedAt = performance.now();
        const update = () => {
            const totalElapsed =
                (performance.now() - this.animationStartedAt) / 1000;
            if (!this.data) return;
            const cycleElapsed =
                totalElapsed % this.data.simulation.durationSeconds;
            for (const runtime of this.vehicles) {
                const sampleTime = [
                    cycleElapsed - this.data.simulation.durationSeconds,
                    cycleElapsed,
                    cycleElapsed + this.data.simulation.durationSeconds
                ].find(
                    (candidate) =>
                        candidate >= runtime.data.startTime &&
                        candidate <= runtime.data.endTime
                );
                runtime.entity.show = sampleTime !== undefined;
                if (sampleTime === undefined) continue;
                const simulationTime = Cesium.JulianDate.addSeconds(
                    epoch,
                    sampleTime,
                    new Cesium.JulianDate()
                );
                const nextPosition =
                    runtime.sampledPosition.getValue(simulationTime);
                const nextOrientation =
                    runtime.sampledOrientation.getValue(simulationTime);
                if (nextPosition) runtime.position.setValue(nextPosition);
                if (nextOrientation) {
                    runtime.orientation.setValue(
                        Cesium.Quaternion.multiply(
                            nextOrientation,
                            orientationFix,
                            new Cesium.Quaternion()
                        )
                    );
                }
            }
        };
        this.removeUpdateListener =
            this.viewer.scene.preUpdate.addEventListener(update);

        const firstSample = data.vehicles[0]?.samples[0];
        if (firstSample) {
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    firstSample.longitude,
                    firstSample.latitude,
                    firstSample.height + 180
                ),
                duration: 1.5
            });
        }
    }
}
