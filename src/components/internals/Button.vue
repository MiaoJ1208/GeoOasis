<script setup lang="ts"></script>

<template>
    <button class="btn">
        <slot></slot>
    </button>
</template>

<style lang="css" scoped>
button {
    all: unset;
}

.btn {
    flex: 0 0 auto;
    color: #1781ff;
    background: rgba(173, 216, 230, 0.9);
    height: 25px;
    padding: 0 5px;
    border-radius: 4px;
    display: inline-flex;
    font-size: 15px;
    line-height: 1;
    align-items: center;
    justify-content: center;
}

.btn:hover {
    background-color: var(#1781ff);
    color: var(#44a1ff);
}

.btn:focus {
    position: relative;
    box-shadow: 0 0 0 2px var(#1781ff);
}

.btn {
    padding-left: 10px;
    padding-right: 10px;
    color: rgb(12, 11, 11);
    background-color: var(#1781ff);
}

.btn:hover {
    color: white;
    background-color: var(#1781ff);
}
</style>
