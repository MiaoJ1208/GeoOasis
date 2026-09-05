<script setup lang="ts">
import { useSceneHelper } from "../composables/useSceneHelper";
const { flyToHome } = useSceneHelper();
</script>

<template>
    <div class="footerbar">
        <!-- 注释掉坐标显示以取消获取鼠标坐标功能 -->
        <!-- <div class="infobar">
            <div class="info">Lng: {{ cursorPosition.lng }}</div>
            <div class="info">Lat: {{ cursorPosition.lat }}</div>
            <div class="info">Height: {{ cursorPosition.height }}</div>
        </div> -->
        <button type="button" class="home" @click="flyToHome">
            返回全局视图
        </button>
    </div>
</template>

<style scoped>
.footerbar {
    position: fixed;
    z-index: var(--ui-z-base-control);
    top: 82px;
    left: 288px;
    display: flex;
}

.infobar {
    display: flex;
    justify-content: center;
    align-items: center;
}

.info {
    margin: 2px 10px;
    text-align: center;
    pointer-events: none;
}

.home {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.28);
    color: var(--ui-text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--ui-transition);
}

.home:hover {
    border-color: var(--ui-border-strong);
    background: var(--ui-surface-hover);
    color: var(--ui-text);
}

@media (max-width: 920px) {
    .footerbar {
        top: 126px;
        left: 240px;
    }

    .home {
        min-height: 44px;
    }
}

@media (max-width: 620px) {
    .footerbar {
        top: auto;
        bottom: 206px;
        left: 8px;
    }
}
</style>
