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
import { computed, ref, watchEffect } from "vue";
import { storeToRefs } from "pinia";
import { useGeoOasisStore } from "../store/GeoOasis.store";

const store = useGeoOasisStore();
const { roomId, userList } = storeToRefs(store);
const { editor } = store;

const userName = ref("");
const inputVal = ref("");
const isConnected = computed(() => !!roomId.value);

const handleGenerateRoomId = () => {
    roomId.value = editor.changeRoom();
    inputVal.value = roomId.value;
};

watchEffect(() => {
    userName.value = userList.value.length > 0 ? userList.value[0].name : "";
});

const handleConnect = () => {
    if (!isConnected.value) {
        roomId.value = editor.changeRoom(inputVal.value);
    } else {
        editor.disconnectProvider();
        roomId.value = "";
    }
};
</script>

<template>
    <DialogRoot>
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
                    <label class="Label" for="url">用户名</label>
                    <input
                        id="url"
                        class="Input"
                        placeholder="请输入用户名"
                        v-model="userName"
                    />
                </fieldset>
                <fieldset v-show="!isConnected" class="Fieldset">
                    <Button @click="handleGenerateRoomId">生成房间ID</Button>
                </fieldset>
                <fieldset class="Fieldset">
                    <label class="Label" for="url">房间ID</label>
                    <input
                        id="url"
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
                    <DialogClose as-child>
                        <button class="Button green" @click="handleConnect">
                            {{ isConnected ? "断开" : "连接" }}
                        </button>
                    </DialogClose>
                </div>
                <DialogClose class="IconButton" aria-label="Close">
                    <Icon icon="lucide:x" />
                </DialogClose>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
