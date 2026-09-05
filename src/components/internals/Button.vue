<script setup lang="ts"></script>

<template>
    <button type="button" class="btn">
        <slot></slot>
    </button>
</template>

<style lang="css" scoped>
button {
    all: unset;
    box-sizing: border-box;
}

.btn {
    display: inline-flex;
    min-height: 36px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: rgba(30, 41, 59, 0.78);
    color: var(--ui-text-secondary);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
        color var(--ui-transition),
        border-color var(--ui-transition),
        background-color var(--ui-transition),
        transform var(--ui-transition);
}

.btn:hover {
    border-color: var(--ui-border-strong);
    background: var(--ui-surface-hover);
    color: var(--ui-text);
}

.btn:active {
    transform: scale(0.97);
}

.btn:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
}
</style>
