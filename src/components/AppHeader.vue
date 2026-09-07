<script setup lang="ts">
import CollabBar from "./CollabBar.vue";
import ToolsBar from "./ToolsBar.vue";
</script>

<template>
    <header class="header-container" aria-label="场景编辑工具栏">
        <div class="app-brand">
            <span class="brand-symbol" aria-hidden="true"></span>
            <h1 class="brand-title">公路交通数字孪生智能平台</h1>
        </div>
        <div class="right-section">
            <ToolsBar />
            <CollabBar />
        </div>
    </header>
</template>

<style scoped>
.header-container {
    position: fixed;
    z-index: var(--ui-z-header);
    top: 14px;
    left: 14px;
    right: 14px;
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
}

.app-brand {
    display: flex;
    min-width: 292px;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    color: var(--ui-text);
}

.brand-symbol {
    width: 10px;
    height: 24px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--ui-accent);
    box-shadow: 0 0 0 4px var(--ui-accent-soft);
}

.brand-title {
    margin: 0;
    overflow: hidden;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.right-section {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}

@media (max-width: 1180px) {
    .app-brand {
        min-width: 210px;
    }

    .brand-title {
        max-width: 180px;
    }
}

@media (max-width: 920px) {
    .header-container {
        top: 8px;
        left: 8px;
        right: 8px;
    }

    .app-brand {
        min-width: auto;
        padding: 0 6px;
    }

    .brand-title {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        clip-path: inset(50%);
    }

    .right-section {
        overflow-x: auto;
        justify-content: flex-start;
        padding: 2px;
    }
}
</style>
