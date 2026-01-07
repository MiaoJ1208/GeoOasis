// src/clipping/tunnelClipping.ts
import {
    Cartesian3,
    ClippingPlane,
    ClippingPlaneCollection,
    Transforms
} from "cesium";

export function createTunnelClippingPlanes(
    center: Cartesian3,
    options?: {
        width?: number;
        height?: number;
        enabled?: boolean;
    }
) {
    const width = options?.width ?? 80;
    const height = options?.height ?? 60;

    const planes = [
        new ClippingPlane(new Cartesian3(1, 0, 0), width),
        new ClippingPlane(new Cartesian3(-1, 0, 0), width),
        new ClippingPlane(new Cartesian3(0, 1, 0), width),
        new ClippingPlane(new Cartesian3(0, -1, 0), width),
        new ClippingPlane(new Cartesian3(0, 0, 1), height),
        new ClippingPlane(new Cartesian3(0, 0, -1), height)
    ];

    return new ClippingPlaneCollection({
        planes,
        unionClippingRegions: true,
        enabled: options?.enabled ?? true,
        modelMatrix: Transforms.eastNorthUpToFixedFrame(center)
    });
}
