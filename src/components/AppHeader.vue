<script setup lang="ts">
import BoardBar from "./BoardBar.vue";
import CollabBar from "./CollabBar.vue";
import ToolsBar from "./ToolsBar.vue";
</script>

<template>
    <div class="header-container">
        <BoardBar />
        <div class="right-section">
            <ToolsBar />
            <CollabBar />
        </div>
    </div>
</template>

<style scoped>
.header-container {
    position: fixed;
    top: 30px;
    left: 30px;
    right: 30px;
    display: flex;
    gap: 20px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

.right-section {
    display: flex;
    gap: 20px;
    align-items: center;
}
</style>
