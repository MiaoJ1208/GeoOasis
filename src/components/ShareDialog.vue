<script setup lang="ts">
import "./Dialog.css";
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
import Button from "./internals/Button.vue";
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { nanoid } from "nanoid";
import { ElMessage } from "element-plus";
import { useGeoOasisStore } from "../store/GeoOasis.store";

const store = useGeoOasisStore();
const { roomId } = storeToRefs(store);
const { editor, getUserName, setUserName } = store;

const userName = ref(getUserName());
const inputVal = ref("");
const isOpen = ref(false);
const isConnected = computed(() => !!roomId.value);

const handleGenerateRoomId = () => {
    inputVal.value = nanoid();
};

const handleConnect = () => {
    if (isConnected.value) {
        editor.disconnectProvider();
        roomId.value = "";
        isOpen.value = false;
        return;
    }

    const name = userName.value.trim();
    const nextRoomId = inputVal.value.trim();
    if (!name) {
        ElMessage.error("请输入用户名");
        return;
    }
    if (!nextRoomId) {
        ElMessage.error("请输入或生成房间 ID");
        return;
    }

    setUserName(name);
    roomId.value = editor.changeRoom(nextRoomId);
    inputVal.value = roomId.value;
    isOpen.value = false;
};
</script>

<template>
    <DialogRoot v-model:open="isOpen">
        <DialogTrigger class="btn" style="margin-left: auto">
            <slot name="trigger"></slot>
        </DialogTrigger>
        <DialogPortal>
            <DialogOverlay class="DialogOverlay" />
            <DialogContent class="DialogContent">
                <DialogTitle class="DialogTitle">分享至协作者</DialogTitle>
                <DialogDescription class="DialogDescription">
                    与其他用户协同编辑公路交通场景
                </DialogDescription>
                <fieldset class="Fieldset">
                    <label class="Label" for="username">用户名</label>
                    <input
                        id="username"
                        class="Input"
                        placeholder="请输入用户名"
                        v-model="userName"
                    />
                </fieldset>
                <fieldset v-show="!isConnected" class="Fieldset">
                    <Button @click="handleGenerateRoomId">生成房间ID</Button>
                </fieldset>
                <fieldset class="Fieldset">
                    <label class="Label" for="room-id">房间ID</label>
                    <input
                        id="room-id"
                        class="Input"
                        placeholder="请输入房间ID"
                        v-model="inputVal"
                        :disabled="isConnected"
                    />
                </fieldset>
                <div
                    :style="{
                        display: 'flex',
                        marginTop: 25,
                        justifyContent: 'flex-end'
                    }"
                >
                    <button class="Button green" @click="handleConnect">
                        {{ isConnected ? "断开" : "连接" }}
                    </button>
                </div>
                <DialogClose class="IconButton" aria-label="Close">
                    <Icon icon="lucide:x" />
                </DialogClose>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
