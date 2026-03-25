import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

// WebSocket 端口
const PORT = 8081;

// 轨迹数据路径（按你现在的数据来）
const dataPath = path.resolve(
    process.cwd(),
    "public/data/20251030_163823_170604/Simulatedtrajectory1.json"
);

// 读取并解析数据
const raw = fs.readFileSync(dataPath, "utf-8");
const data = JSON.parse(raw);

// 必须按时间排序
data.sort(
    (a: any, b: any) =>
        Number(a.timeStamp?.$numberLong ?? 0) -
        Number(b.timeStamp?.$numberLong ?? 0)
);

const wss = new WebSocketServer({ port: PORT });

console.log(`[WS] server started at ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] client connected");

    let index = 0;

    const pushNext = () => {
        if (index >= data.length) {
            ws.close();
            return;
        }

        ws.send(JSON.stringify(data[index]));

        if (index < data.length - 1) {
            const dt =
                Number(data[index + 1].timeStamp.$numberLong) -
                Number(data[index].timeStamp.$numberLong);

            setTimeout(pushNext, Math.max(50, dt));
        }

        index++;
    };

    pushNext();

    ws.on("close", () => {
        console.log("[WS] client disconnected");
    });
});
