<script setup lang="ts">
import "./ToolsBar.css";
import {
    ToolbarButton,
    ToolbarRoot,
    ToolbarSeparator,
    ToolbarToggleGroup,
    ToolbarToggleItem
} from "radix-vue";
import ToolbarUploadButton from "./internals/UploadButton.vue";
import Dialog from "./Dialog.vue";
import { Icon } from "@iconify/vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { useUpLoadFile } from "../composables/useUpLoadFile";
import { useYjs } from "../composables/useYjs";
import { DrawMode, GizmoMode } from "../editor/type";

const toolOptions = [
    {
        value: "default",
        label: "默认",
        icon: "material-symbols:near-me-outline"
    },
    {
        value: "marker",
        label: "标记",
        icon: "material-symbols:location-on-outline"
    },
    {
        value: "point",
        label: "点",
        icon: "material-symbols:radio-button-checked"
    },
    {
        value: "polyline",
        label: "折线",
        icon: "material-symbols:timeline"
    },
    {
        value: "polygon",
        label: "多边形",
        icon: "material-symbols:pentagon-outline"
    },
    {
        value: "model",
        label: "模型",
        icon: "material-symbols:view-in-ar-outline"
    }
];
const gizmoModeOptions = [
    {
        label: GizmoMode.TRANSLATE,
        icon: "material-symbols:open-with"
    },
    {
        label: GizmoMode.ROTATE,
        icon: "material-symbols:360"
    },
    {
        label: GizmoMode.UNIFORM_SCALE,
        icon: "material-symbols:aspect-ratio"
    }
];

const store = useGeoOasisStore();
const { activeTool, drawMode, gizmoMode, selectedModelIdx, assetsOption } =
    storeToRefs(store);

const { undo, redo } = useYjs();
const { selectedFile } = useUpLoadFile();

const modelBarVisible = computed(() => activeTool.value === "model");
</script>

<template>
    <ToolbarRoot class="ToolbarRoot">
        <ToolbarToggleGroup
            aria-label="编辑坐标模式"
            :model-value="drawMode"
            @update:model-value="
                (val) => {
                    if (val) drawMode = val as DrawMode;
                }
            "
            type="single"
        >
            <ToolbarToggleItem
                class="ToolbarToggleItem"
                :value="DrawMode.SURFACE"
                aria-label="贴地编辑"
                title="贴地编辑"
            >
                <Icon icon="material-symbols:layers-outline" />
            </ToolbarToggleItem>
            <ToolbarToggleItem
                class="ToolbarToggleItem"
                :value="DrawMode.SPACE"
                aria-label="空间变换"
                title="空间变换"
            >
                <Icon icon="material-symbols:deployed-code-outline" />
            </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarToggleGroup
            class="GizmoModeGroup"
            aria-label="空间变换模式"
            :model-value="gizmoMode"
            @update:model-value="
                (val) => {
                    if (val) gizmoMode = val as GizmoMode;
                }
            "
            v-show="drawMode === DrawMode.SPACE"
            type="single"
        >
            <ToolbarToggleItem
                class="ToolbarToggleItem"
                v-for="item in gizmoModeOptions"
                :key="item.label"
                :value="item.label"
                :aria-label="item.label"
                :title="item.label"
            >
                <Icon :icon="item.icon" />
            </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarSeparator class="ToolbarSeparator" />
        <ToolbarToggleGroup
            aria-label="绘制工具"
            v-model="activeTool"
            :disabled="drawMode === DrawMode.SPACE"
            type="single"
        >
            <ToolbarToggleItem
                class="ToolbarToggleItem"
                v-for="item in toolOptions"
                :key="item.value"
                :value="item.value"
                :title="item.label"
                :aria-label="item.label"
            >
                <Icon :icon="item.icon" />
            </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarSeparator class="ToolbarSeparator" />
        <ToolbarUploadButton v-model="selectedFile">
            上传
            <Icon icon="material-symbols:upload-file-outline" />
        </ToolbarUploadButton>
        <Dialog>
            <template #trigger>
                <span>链接</span>
                <Icon icon="material-symbols:add-link" />
            </template>
        </Dialog>
        <ToolbarButton class="ToolbarButton history-button" @click="undo">
            撤销
        </ToolbarButton>
        <ToolbarButton class="ToolbarButton history-button" @click="redo">
            恢复
        </ToolbarButton>
    </ToolbarRoot>
    <div v-show="modelBarVisible" class="ModelBar">
        <button
            type="button"
            class="ModelBarItem"
            :class="{ ModelBarItemActive: selectedModelIdx === index }"
            v-for="(item, index) in assetsOption"
            :key="item.id"
            @click="selectedModelIdx = index"
        >
            {{ item.name }}
        </button>
    </div>
</template>
