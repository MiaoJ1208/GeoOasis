<script setup lang="ts">
import "./CollabBar.css";
import { AvatarFallback, AvatarRoot } from "radix-vue";
import ShareDialog from "./ShareDialog.vue";
import { useSceneHelper } from "../composables/useSceneHelper";
import { useGeoOasisStore } from "../store/GeoOasis.store";

const store = useGeoOasisStore();
const { synOtherUserCamera } = useSceneHelper();
</script>

<template>
    <div class="collabbar">
        <AvatarRoot
            class="AvatarRoot"
            v-for="user in store.userList"
            :key="user.id"
            as="button"
            :aria-label="`跟随协作者 ${user.name} 的视角`"
            :title="user.name"
            @click="synOtherUserCamera(user)"
        >
            <AvatarFallback class="AvatarFallback">
                {{ user.name.slice(0, 2) }}
            </AvatarFallback>
        </AvatarRoot>

        <ShareDialog>
            <template #trigger>
                <span>分享</span>
            </template>
        </ShareDialog>
    </div>
</template>
