# 承平高速交通态势分析功能实现指南

## 1.功能概述

承平高速交通态势分析功能复用了项目中已有的“交通态势预测”播放、暂停、时间线拖动和 Cesium 实体更新逻辑。功能开启后，系统读取承平高速专用模拟数据，根据不同时刻的拥堵等级动态更新道路分级颜色线。

本功能的数据范围围绕 `public/3DTiles/WGS84` 模型附近展开，使用承平高速道路级中心线数据生成模拟交通态势。

## 2.数据文件

交通态势数据文件：

```text
public/data/cpgs84/chengping_traffic_with_speeds.geojson
```

前端加载入口位于 `src/components/RoadVisual.vue` 的 `loadTrafficData()`，当前读取上述文件。后续如果需要替换为真实数据，优先保持相同 GeoJSON 字段结构。

## 3.模拟数据来源

道路几何来源：

```text
public/data/cpgs84/RoadCenterLine.geojson
```

当前实现采用道路级中心线，而不是车道级 `LaneCenterline.geojson`。原因是 `RoadCenterLine.geojson` 在模型附近存在一条较连续的承平高速主线，更适合表达宏观交通态势。

具体选取规则：

- 主线：使用 `RoadCenterLine.geojson` 中的 `recordNumber = 30`。
- 连接线：使用模型附近的 `recordNumber = 23, 24, 25, 26, 27, 28`。
- 主线范围：以 `public/3DTiles/WGS84/tileset.json` 的模型包围范围为中心，外扩 8km。
- 坐标约束：所有生成道路坐标都来自 `RoadCenterLine.geojson` 的真实坐标点。

## 4.分段方式

主线会进行切段，连接线不切段。

主线切段规则：

- 只在 `RoadCenterLine.geojson` 已有顶点处切分。
- 目标长度约 2.2km。
- 每段控制在 1km 到 3km 范围内。

当前主线共 10 段，长度约为：

```text
2201.7m, 2203.4m, 2202.2m, 2201.7m, 2201.8m,
2204.5m, 2200.3m, 2200.6m, 2200.9m, 1846.0m
```

连接线保持原始 RoadCenterLine 分段，不额外切分：

```text
record 23: 561.4m
record 24: 345.3m
record 25: 74.2m
record 26: 56.8m
record 27: 228.2m
record 28: 495.2m
```

## 5.时间序列

模拟时间从中国春运期间的典型日期开始：

```text
2026-02-13T00:00:00
```

时间配置：

- 间隔：15 分钟
- 数量：96 个时间点
- 覆盖范围：完整 1 天

## 6.车速与拥堵等级

每条道路 Feature 同时包含 `speeds` 和 `traffic_level`：

- `speeds`：模拟车速，单位为 `km/h`。
- `traffic_level`：由车速换算得到的拥堵等级，用于当前前端着色。

等级对应关系：

| 拥堵等级 | 含义 | 车速范围 | 显示颜色 |
|---|---|---|---|
| 1 | 畅通 | `speed >= 90`  | 绿色 🟢|
| 2 | 基本畅通 | `70 <= speed < 90` | 青色 🔵|
| 3 | 轻度拥堵 | `50 <= speed < 70` | 黄色 🟡|
| 4 | 中度拥堵 | `30 <= speed < 50` | 橙色 🟠|
| 5 | 严重拥堵 | `speed < 30` | 红色 🔴|

当前模拟以主线畅通和基本畅通为主，10-13 点、18-21 点部分主线切段出现轻度或少量中度拥堵。

## 7.GeoJSON 字段结构

每个 Feature 的主要字段如下：

```json
{
  "type": "Feature",
  "properties": {
    "Id": "CP-MAIN-001",
    "road_name": "承平高速主线",
    "roadRole": "mainline",
    "source": "RoadCenterLine.geojson",
    "sourceRecordNumber": 30,
    "segmentLengthMeters": 2201.7,
    "speedUnit": "km/h",
    "speeds": {},
    "traffic_level": {}
  },
  "geometry": {
    "type": "LineString",
    "coordinates": []
  }
}
```

其中 `roadRole` 用于区分：

- `mainline`：承平高速主线分段。
- `connector`：模型附近连接线。

## 8.前端复用关系

本功能复用已有交通态势预测模块，不重复实现时间线或播放控制。

复用内容包括：

- `loadTrafficData()`：加载 GeoJSON，提取时间戳和道路态势数据。
- `updateTrafficDisplay(timestampIndex)`：按当前时间片更新道路颜色线。
- `startTrafficAnimation()` / `stopTrafficAnimation()`：控制播放和清理。
- `pauseTrafficAnimation()` / `resumeTrafficAnimation()`：控制暂停与恢复。
- `handleTimelineChange(progress)`：支持手动拖动时间线。
- `getTrafficLevelColor(level)`：根据拥堵等级返回 Cesium 颜色。

本功能的主要差异是数据源路径和态势线显示层级：

- 数据源路径切换为 `/data/cpgs84/chengping_traffic_with_speeds.geojson`。
- 态势线实体加入独立的 `Cesium.CustomDataSource("cpgs_traffic_analysis")`。
- 每次更新时间片后调用 `viewer.dataSources.raiseToTop(...)`，让态势线显示在道路面、道路线等基础图层上方。
- 态势线保持贴地显示，`clampToGround = true`，线宽为 6，避免悬浮。

## 9.使用流程

1. 用户点击功能面板中的“交通态势预测”。
2. `isTrafficAnalysis` 状态切换为启用。
3. `RoadVisual.vue` 监听状态变化，加载承平高速交通态势数据。
4. 系统按时间线逐帧更新 `cpgs_traffic_analysis` 数据源中的态势线实体。
5. 用户可播放、暂停或拖动时间线查看不同时刻的态势。
6. 再次关闭功能时，清除当前态势线实体。

## 10.维护建议

- 若要更新道路范围，优先调整 `RoadCenterLine.geojson` 的主线记录或主线外扩范围。
- 若要接入真实交通数据，保持 `speeds` 和 `traffic_level` 字段结构不变，可减少前端改动。
- 若道路基础图层再次遮盖态势线，优先检查 `cpgs_traffic_analysis` 数据源是否仍在 `viewer.dataSources` 顶层，以及态势线是否仍为贴地线。
