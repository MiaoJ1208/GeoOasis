<script setup lang="ts">
import { Label } from "radix-vue";
import { Icon } from "@iconify/vue";
import Button from "./internals/Button.vue";
import Separator from "./internals/Separator.vue";
import Switch from "./internals/Switch.vue";
import Select from "./internals/Select.vue";
import { useInfoPanel } from "../composables/useInfoPanel";
import { useGeoOasisStore } from "../store/GeoOasis.store";
import { storeToRefs } from "pinia";

const store = useGeoOasisStore();
const { isPanelVisible } = storeToRefs(store);

const {
    form,
    selectedElement,
    selectedLayer,
    isToolBoxVisible,
    selectedTool,
    tools,
    isWasm,
    handleElementChange,
    handleExecuteBtn
} = useInfoPanel();
</script>

<template>
    <aside class="info-panel" v-show="isPanelVisible" aria-label="选中对象属性">
        <div v-show="selectedElement">
            <div v-for="(value, _index) in form" class="info-panel-item">
                <div v-if="value[0] === 'name'">
                    <Label class="LabelRoot" :for="value[0]">
                        {{ value[0] }}
                    </Label>
                    <input
                        :id="value[0]"
                        class="Input"
                        type="text"
                        :value="value[1]"
                        @change="
                            (e: any) =>
                                handleElementChange({
                                    name: e.target.value
                                })
                        "
                    />
                </div>
                <div v-else-if="value[0] === 'description'">
                    <Label class="LabelRoot" :for="value[0]">
                        {{ value[0] }}
                    </Label>
                    <el-input
                        type="textarea"
                        v-model="value[1]"
                        @change="
                            (value: string) =>
                                handleElementChange({ description: value })
                        "
                    />
                </div>
                <div
                    v-else-if="
                        selectedElement?.type === 'point' &&
                        value[0] === 'color'
                    "
                >
                    <Label class="LabelRoot" :for="value[0]">
                        {{ value[0] }}
                    </Label>
                    <el-color-picker
                        v-model="value[1]"
                        @change="
                            (value: any) =>
                                handleElementChange({ color: value })
                        "
                    />
                </div>
                <div
                    v-else-if="
                        selectedElement?.type === 'point' &&
                        value[0] === 'pixelSize'
                    "
                >
                    <Label class="LabelRoot" :for="value[0]">
                        {{ value[0] }}
                    </Label>
                    <el-input-number
                        v-model="value[1]"
                        :min="1"
                        :max="100"
                        size="small"
                        @change="
                            (cur: number | undefined) =>
                                handleElementChange({ pixelSize: cur })
                        "
                    />
                </div>
            </div>
        </div>
        <div v-show="selectedLayer">
            <div class="info-panel-item">
                <Label class="LabelRoot">name:</Label>
                {{ selectedLayer?.name }}
            </div>
            <div v-if="selectedLayer?.type === 'service'">
                <div class="info-panel-item">
                    <div class="info-panel-toolbar">
                        <Button @click="isToolBoxVisible = !isToolBoxVisible">
                            <Icon
                                icon="material-symbols:settings-outline-rounded"
                            />
                        </Button>
                    </div>
                </div>
            </div>
            <Separator />
            <div v-show="isToolBoxVisible">
                <div class="info-panel-item">
                    <Select
                        title="Tools"
                        :selected="selectedTool"
                        :select-options="tools"
                        @update:model-value="selectedTool = $event"
                    ></Select>
                </div>
                <div class="info-panel-item">
                    <Switch
                        :checked="isWasm"
                        name="wasm mode:"
                        @update:checked="(checked) => (isWasm = checked)"
                    />
                </div>
                <div class="info-panel-item">
                    <Button @click="handleExecuteBtn(selectedTool)">
                        Execute
                        <Icon icon="material-symbols:play-arrow-outline" />
                    </Button>
                </div>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.info-panel {
    position: fixed;
    z-index: var(--ui-z-context-panel);
    top: 160px;
    right: 272px;
    width: 270px;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    padding: 16px;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface-strong);
    box-shadow: var(--ui-shadow);
    color: var(--ui-text-secondary);
}

.info-panel-item {
    margin: 12px 0;
}

.info-panel-toolbar {
    margin: 5px;
    display: flex;
}

/* reset */
input {
    all: unset;
    box-sizing: border-box;
}

.LabelRoot {
    display: block;
    margin-bottom: 5px;
    color: var(--ui-text-muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    text-transform: capitalize;
}

.Input {
    width: 100%;
    height: 40px;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: rgba(2, 6, 23, 0.52);
    color: var(--ui-text);
    font-size: 13px;
    line-height: 1;
    transition: var(--ui-transition);
}

.Input:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px var(--ui-accent-soft);
}

.Input::selection {
    background-color: var(--ui-accent);
    color: white;
}

.info-panel :deep(.el-input__wrapper),
.info-panel :deep(.el-textarea__inner) {
    border: 1px solid var(--ui-border);
    background: rgba(2, 6, 23, 0.52);
    box-shadow: none;
    color: var(--ui-text);
}

@media (max-width: 1100px) {
    .info-panel {
        top: 152px;
        right: 226px;
        width: 240px;
    }
}

@media (max-width: 620px) {
    .info-panel {
        top: auto;
        right: 8px;
        bottom: 212px;
        left: 8px;
        width: auto;
        max-height: 34vh;
    }
}
</style>
