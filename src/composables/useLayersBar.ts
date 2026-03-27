import { onMounted, watch, ShallowRef } from "vue";
import { BoundingSphere, Cartesian3 } from "cesium";
import { storeToRefs } from "pinia";
import * as Y from "yjs";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { YElement } from "../type";
import { YImageryLayer } from "../editor/imageryLayerManager";
import { TerrainOption } from "../editor/terrain";

export const useLayersBar = () => {
    const store = useGeoOasisStore();
    const {
        selectedTerrain,
        selectedBaseLayer,
        selectedElement,
        selectedLayer,
        elementArray,
        layersArray,
        imageryLayersArray,
        isTrafficAnalysis
    } = storeToRefs(store);
    const { editor } = store;

    // mounted
    onMounted(() => {
        console.log("LayersBar mounted");
    });

    watch(selectedBaseLayer, () => {
        editor.setBaseLayer(selectedBaseLayer.value);
    });

    const handleSelect = (id: string) => {
        selectedElement.value = editor.getElement(id);
        selectedLayer.value = editor.getLayer(id);
        // 当点击的是元素时，飞到该元素所在位置
        if (selectedElement.value && selectedElement.value.positions?.length) {
            const cartesians = selectedElement.value.positions.map((p) =>
                Cartesian3.fromElements(p.x, p.y, p.z)
            );
            const sphere = BoundingSphere.fromPoints(cartesians);
            editor.viewer?.camera.flyToBoundingSphere(sphere, {
                duration: 1.5
            });
        }
    };

    const handleDelete = (id: string) => {
        editor.deleteElement(id);
        editor.deleteLayer(id);
        selectedElement.value = undefined;
        selectedLayer.value = undefined;
    };

    const selectTerrain = (terrain: TerrainOption) => {
        editor.setTerrain(terrain);
    };

    return {
        selectedTerrain,
        selectedBaseLayer,
        elementArray: elementArray as ShallowRef<YElement[]>,
        layersArray: layersArray as ShallowRef<Y.Map<any>[]>,
        imageryLayersArray: imageryLayersArray as ShallowRef<YImageryLayer[]>,
        handleSelect,
        handleDelete,
        selectTerrain,
        isTrafficAnalysis
    };
};
