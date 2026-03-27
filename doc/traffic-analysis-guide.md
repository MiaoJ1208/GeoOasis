# 交通态势预测功能实现指南

## 功能概述

本文档说明GeoOasis中交通态势预测（Traffic Analysis）功能的实现。该功能可以根据不同时刻的交通速度数据，动态显示道路的拥堵情况。

## 核心功能

### 1. 速度等级分类

系统根据实时速度将道路分为4个等级，使用不同颜色表示：

```
速度 >= 60 km/h  → 绿色（🟢 流畅）
40 <= 速度 < 60  → 黄色（🟡 正常）
20 <= 速度 < 40  → 橙色（🟠 缓慢）
速度 < 20        → 红色（🔴 拥堵）
```

### 2. 数据源格式

交通数据文件位置：`/public/data/road_network_with_speeds.geojson`

GeoJSON格式结构：

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "Id": "90217",
        "道路序": 1,
        "speeds": {
          "2015-01-26T02:15:00": 30.030685,
          "2015-01-26T02:30:00": 30.445892,
          // ... 更多时间戳和速度数据
        }
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], [lon, lat], ...]
      }
    }
  ]
}
```

### 3. 关键实现函数

#### `loadTrafficData()`

-   加载并解析GeoJSON交通数据文件
-   提取所有唯一的时间戳并排序
-   将数据存储在 `trafficDataMap` 中

#### `updateTrafficDisplay(timestampIndex: number)`

-   根据给定的时间戳索引更新显示
-   为每条路段创建Polyline实体
-   根据当前速度值设置相应颜色
-   清除旧的实体，防止内存泄漏

#### `startTrafficAnimation()`

-   启动时间线动画
-   每隔1秒（可配置）更新一次显示
-   循环播放所有时间戳

#### `stopTrafficAnimation()`

-   停止动画并清除所有实体
-   设置播放状态为false

#### `pauseTrafficAnimation()` **[新增]**

-   暂停当前动画（不清除实体）
-   保持当前显示的时刻画面

#### `resumeTrafficAnimation()` **[新增]**

-   从暂停状态继续播放动画

#### `handleTimelineChange(progress: number)` **[新增]**

-   处理用户拖动进度条的事件
-   计算对应的时间戳索引
-   更新显示到对应的时刻

#### `getSpeedColor(speed: number): Cesium.Color`

-   根据速度值返回对应颜色
-   支持自定义配置

## 使用流程

### 1. 启用交通态势分析

用户在UI的LayersBar中点击"交通态势"按钮，触发：

```typescript
isTrafficAnalysis.value = true;
```

### 2. 自动流程触发

RoadVisual.vue中的watch监听器捕捉到状态变化：

```typescript
watch(isTrafficAnalysis, async (newVal) => {
    if (newVal) {
        // 加载数据并启动动画
        if (trafficTimestamps.length === 0) {
            await loadTrafficData();
        }
        startTrafficAnimation();
    } else {
        stopTrafficAnimation();
    }
});
```

### 3. 禁用交通态势分析

用户再次点击按钮，状态变为false，动画停止，实体清除。

## 时间线控制条使用指南 **[新增]**

### UI 组件位置

时间线控制条位于屏幕底部中央，仅在交通态势分析启用时显示。

### UI 元素说明

1. **播放/暂停按钮** (⏸/▶)

    - 圆形紫色渐变按钮
    - 点击切换播放/暂停状态
    - 鼠标悬停时放大显示

2. **进度条滑块**

    - 可拖动调节时间戳
    - 拖动时自动暂停动画
    - 支持键盘方向键微调（在滑块焦点时）

3. **时间戳显示** (右侧)

    - 显示当前时刻的ISO 8601格式时间戳
    - 格式：`2015-01-26T02:15:00`
    - 响应式设计中移动设备上会隐藏

4. **进度百分比** (右上角)
    - 显示当前进度百分比 (0-100%)
    - 实时更新

### 操作方式

#### 方式 1：自动播放

1. 启用交通态势分析
2. 进度条自动从 0% 开始播放
3. 每秒自动推进到下一个时间戳
4. 到达100%后，循环回到0%重新开始

#### 方式 2：手动调节

1. 点击进度条上任意位置（或拖动滑块）
2. 自动暂停当前播放
3. 地图显示对应时刻的交通态势
4. 点击▶按钮继续播放

#### 方式 3：逐步调节

1. 在弹出的数字输入框中直接输入百分比值
2. 或使用滑块上的方向键进行微调
3. 显示实时更新

### 状态示意

```
播放状态:  ▶ (播放中) → 点击 → ⏸ (已暂停)
          地图自动更新     手动拖动   地图不动
          每秒推进        可精确调  保持当前时刻
```

### 响应式样式

-   **桌面端** (768px+): 完整显示所有元素，时间戳右对齐
-   **平板端** (480-768px): 缩小字体和按钮，保留所有功能
-   **移动端** (<480px): 隐藏时间戳显示，按钮和进度条优化布局

## 使用流程

### 1. 启用交通态势分析

用户在UI的LayersBar中点击"交通态势"按钮，触发：

```typescript
isTrafficAnalysis.value = true;
```

### 2. 自动流程触发

RoadVisual.vue中的watch监听器捕捉到状态变化：

```typescript
watch(isTrafficAnalysis, async (newVal) => {
    if (newVal) {
        // 加载数据并启动动画
        if (trafficTimestamps.length === 0) {
            await loadTrafficData();
        }
        startTrafficAnimation();
    } else {
        stopTrafficAnimation();
    }
});
```

### 3. 禁用交通态势分析

用户再次点击按钮，状态变为false，动画停止，实体清除，时间线控制条隐藏。

## 配置参数

### 时间线更新间隔

```typescript
const TRAFFIC_UPDATE_INTERVAL = 1000; // 毫秒
```

修改此值可以改变动画速度。例如改为 500ms 可以更快播放。

### 时间线控制条样式（CSS）

主要 CSS 变量和配置（可在 `<style scoped>` 中自定义）：

```css
/* 控制条背景 */
.traffic-timeline-control {
    background: rgba(0, 0, 0, 0.8); /* 透明度 */
    border-radius: 8px; /* 圆角 */
    bottom: 20px; /* 距屏幕底部距离 */
}

/* 按钮渐变色 */
.play-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 进度条颜色 */
.timeline-slider {
    background: linear-gradient(to right, #667eea 0%, #764ba2 100%);
}
```

### 速度阈值

在 `getSpeedColor()` 函数中修改阈值：

```typescript
if (speed >= 60) {
    /* 绿色 */
} else if (speed >= 40) {
    /* 黄色 */
} else if (speed >= 20) {
    /* 橙色 */
} else {
    /* 红色 */
}
```

可根据实际需求调整这些数值。

## 性能优化建议

1. **内存管理**：每次更新都会创建新实体并清除旧实体，确保不会导致内存泄漏

2. **数据预加载**：首次加载时会缓存所有数据，后续操作只进行渲染更新

3. **采样优化**：可以对时间戳进行采样，减少动画帧数：

    ```typescript
    trafficTimestamps = trafficTimestamps.filter((_, i) => i % 2 === 0); // 每隔一个采样
    ```

4. **面层优化**：使用 `clampToGround: true` 让线段贴地面，提高渲染效率

## 响应式状态变量 **[新增]**

| 变量                      | 类型           | 说明               |
| ------------------------- | -------------- | ------------------ |
| `trafficTimelineProgress` | `Ref<number>`  | 进度条进度 (0-100) |
| `isTrafficPlaying`        | `Ref<boolean>` | 是否正在播放       |
| `currentTrafficTimestamp` | `Ref<string>`  | 当前时间戳字符串   |

这些状态变量与时间线控制条的UI元素绑定，实时反映动画状态。

## 扩展功能建议

1. ✅ **时间线控制条** - 已实现
2. **统计信息面板**：显示当前时刻的平均速度、拥堵路段统计等
3. **导出功能**：导出特定时段的交通态势数据
4. **多路段对比**：支持多个时间戳的并行展示比较
5. **热力图**：改用热力图展示，使用渐变颜色表示拥堵程度
6. **速度动画曲线**：在进度条下方显示整日交通速度变化曲线
7. **快进/快退按钮**：支持跳过多个时间戳快速导航
8. **时间跳转输入框**：直接输入时间戳快速跳转
9. **热力图**：改用热力图展示，使用渐变颜色表示拥堵程度

## 相关代码位置

-   主实现文件：`src/components/RoadVisual.vue`
-   状态管理：`src/store/GeoOasis.store.ts`（isTrafficAnalysis）
-   数据源：`public/data/road_network_with_speeds.geojson`
-   UI按钮：`src/components/LayersBar.vue`

## 调试技巧

1. 在浏览器控制台查看输出：

    ```
    [Traffic] Loaded 50 roads with 96 timestamps
    [Traffic Update] Timestamp: 2015-01-26T02:15:00, Entities: 50
    [Traffic] Animation started/paused/resumed/stopped
    [Traffic] Timeline changed to: 50%, Index: 48
    ```

2. 在Cesium Inspector中查看实体信息

3. 修改时间间隔进行性能测试：

    ```typescript
    const TRAFFIC_UPDATE_INTERVAL = 100; // 更快的动画
    const TRAFFIC_UPDATE_INTERVAL = 2000; // 更慢的动画
    ```

4. 在浏览器DevTools中实时修改状态：
    ```javascript
    // 获取组件实例后可直接修改
    roadVisualRef.value.trafficTimelineProgress = 50; // 跳到50%
    roadVisualRef.value.handleTimelineChange(75); // 跳到75%
    ```
