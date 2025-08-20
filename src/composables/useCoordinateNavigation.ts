import { ref } from "vue";
import { Cartesian3, Math as CesiumMath } from "cesium";
import { useGeoOasisStore } from "../store/GeoOasis.store";

export const useCoordinateNavigation = () => {
    const store = useGeoOasisStore();
    
    const longitude = ref("117.353878");
    const latitude = ref("40.261073");
    const height = ref("1000");
    const errorMessage = ref("");

    const flyToCoordinates = () => {
        errorMessage.value = "";
        
        // 验证输入
        const lng = parseFloat(longitude.value);
        const lat = parseFloat(latitude.value);
        const alt = parseFloat(height.value);

        if (isNaN(lng) || isNaN(lat) || isNaN(alt)) {
            errorMessage.value = "请输入有效的数字坐标";
            return;
        }

        if (lng < -180 || lng > 180) {
            errorMessage.value = "经度必须在 -180 到 180 之间";
            return;
        }

        if (lat < -90 || lat > 90) {
            errorMessage.value = "纬度必须在 -90 到 90 之间";
            return;
        }

        if (alt < 0) {
            errorMessage.value = "高度必须大于等于 0";
            return;
        }

        try {
            store.editor.viewer?.camera.flyTo({
                destination: Cartesian3.fromDegrees(lng, lat, alt),
                orientation: {
                    heading: CesiumMath.toRadians(0.0),
                    pitch: CesiumMath.toRadians(-45),
                    roll: 0.0
                },
                duration: 2.0 // 飞行时间2秒
            });
        } catch (error) {
            errorMessage.value = "定位失败，请检查坐标值";
        }
    };

    const clearInputs = () => {
        longitude.value = "";
        latitude.value = "";
        height.value = "1000";
        errorMessage.value = "";
    };

    const flyToLocation = (lng: number, lat: number, alt: number = 1000) => {
        longitude.value = lng.toString();
        latitude.value = lat.toString();
        height.value = alt.toString();
        flyToCoordinates();
    };

    return {
        longitude,
        latitude,
        height,
        errorMessage,
        flyToCoordinates,
        clearInputs,
        flyToLocation
    };
}; 