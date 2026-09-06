<script setup lang="ts">
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
    DialogTrigger
} from "radix-vue";
import { Icon } from "@iconify/vue";
import Switch from "./internals/Switch.vue";
import { ref } from "vue";
import { nanoid } from "nanoid";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { ElMessage } from "element-plus";
import "./Dialog.css";

const store = useGeoOasisStore();
const { editor } = store;
const isGltf = ref(false);
const isCesiumIon = ref(false);
const assetName = ref("");
const asset = ref("");
const isOpen = ref(false);
// const ionToken = ref(""); // TODO:
const handleUpload = () => {
    const name = assetName.value.trim();
    const source = asset.value.trim();

    if (!name) {
        ElMessage.error("请输入资源名称");
        return;
    }
    if (!source) {
        ElMessage.error(
            isCesiumIon.value ? "请输入 Cesium Ion Asset ID" : "请输入资源 URL"
        );
        return;
    }
    if (isCesiumIon.value) {
        if (!/^\d+$/.test(source) || Number(source) <= 0) {
            ElMessage.error("Cesium Ion Asset ID 必须是正整数");
            return;
        }
    } else {
        try {
            const resourceUrl = new URL(source, window.location.origin);
            if (!["http:", "https:"].includes(resourceUrl.protocol)) {
                throw new Error("Unsupported URL protocol");
            }
        } catch {
            ElMessage.error("请输入有效的 HTTP(S) 或站内相对 URL");
            return;
        }
    }

    if (isGltf.value) {
        editor.assetLibrary.addAsset({
            name,
            url: source,
            ion: isCesiumIon.value
        });
    } else {
        editor.addLayer({
            id: nanoid(),
            name,
            type: "3dtiles",
            url: source,
            show: true,
            ion: isCesiumIon.value
        });
    }
    assetName.value = "";
    asset.value = "";
    isOpen.value = false;
};
</script>

<template>
    <DialogRoot v-model:open="isOpen">
        <DialogTrigger class="btn" style="margin-left: 10px">
            <slot name="trigger"></slot>
        </DialogTrigger>
        <DialogPortal>
            <DialogOverlay class="DialogOverlay" />
            <DialogContent class="DialogContent">
                <DialogTitle class="DialogTitle">Upload from Url</DialogTitle>
                <DialogDescription class="DialogDescription">
                    Add 3D Tiles or Gltf Model from url or Cesium Ion
                </DialogDescription>
                <fieldset class="Fieldset">
                    <Switch
                        name="3D Tiles Or Gltf Model"
                        :checked="isGltf"
                        @update:checked="(checked) => (isGltf = checked)"
                    />
                </fieldset>
                <fieldset class="Fieldset">
                    <Switch
                        name="Url Or CesiumIon"
                        :checked="isCesiumIon"
                        @update:checked="(checked) => (isCesiumIon = checked)"
                    />
                </fieldset>
                <fieldset class="Fieldset">
                    <label class="Label" for="asset-name">Asset Name</label>
                    <input
                        id="asset-name"
                        class="Input"
                        placeholder="please input Asset Name"
                        v-model="assetName"
                    />
                </fieldset>
                <fieldset class="Fieldset">
                    <label class="Label" for="asset">
                        Asset {{ isCesiumIon ? "ID" : "Url" }}
                    </label>
                    <input
                        id="asset"
                        class="Input"
                        :placeholder="
                            isCesiumIon
                                ? 'please input cesium Ion Asset Id'
                                : 'please input Url'
                        "
                        v-model="asset"
                    />
                </fieldset>
                <div
                    :style="{
                        display: 'flex',
                        marginTop: 25,
                        justifyContent: 'flex-end'
                    }"
                >
                    <button class="Button green" @click="handleUpload">
                        Add to map
                    </button>
                </div>
                <DialogClose class="IconButton" aria-label="Close">
                    <Icon icon="lucide:x" />
                </DialogClose>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped></style>
