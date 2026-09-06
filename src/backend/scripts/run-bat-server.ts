import express, { Request, Response } from "express";
import cors from "cors";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { access } from "fs/promises";
import { createServer } from "http";
import { Hocuspocus } from "@hocuspocus/server";

// ES modules 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 中间件配置
app.use(
    cors({
        origin: ["http://localhost:5173", "http://localhost:8080"], // 允许前端可视化页面跨域（Vite 默认端口是 5173）
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "x-run-token"] // 允许鉴权头
    })
);
app.use(express.json()); // 解析 JSON 请求体

// 从环境变量获取 bat 文件路径，如果没有则使用默认路径
// 可以通过环境变量 BAT_FILE_PATH 来配置，例如：BAT_FILE_PATH="F:/path/to/file.bat"
const batPath = process.env.BAT_FILE_PATH
    ? path.resolve(process.env.BAT_FILE_PATH)
    : path.resolve(__dirname, "../../../../Fusion-Analysis/system-start.bat");

// 运行批处理文件的接口（添加完整类型注解）
app.post("/run-merge", async (_req: Request, res: Response) => {
    console.log(`收到执行请求，bat 文件路径: ${batPath}`);

    try {
        // 检查 bat 文件是否存在
        await access(batPath);
        console.log(`开始执行 bat 文件: ${batPath}`);

        // 执行 .bat 文件（通过 cmd.exe 调用，确保 Windows 兼容性）
        execFile(
            "cmd.exe",
            ["/c", "start", "", batPath], // start bat and return immediately
            {
                encoding: "utf8" as const, // 指定编码为 utf8
                windowsHide: false, // 显示 cmd 窗口
                timeout: 30 * 1000,
                cwd: path.dirname(batPath) // 执行目录设为批处理文件所在目录（避免相对路径问题）
            },
            (err, stdout, stderr) => {
                if (err) {
                    console.error("批处理执行失败:", err);
                    return res.status(500).json({
                        success: false,
                        error: err.message,
                        stderr: stderr || "",
                        message: "批处理执行失败"
                    });
                }
                console.log("批处理执行成功");
                return res.json({
                    success: true,
                    stdout: stdout || "",
                    stderr: stderr || "",
                    message: "批处理执行成功"
                });
            }
        );
    } catch (err: any) {
        console.error(`bat 文件不存在或无法访问: ${batPath}`, err);
        return res.status(404).json({
            success: false,
            error: `bat 文件不存在: ${batPath}`,
            message:
                "请检查 bat 文件路径是否正确，或通过环境变量 BAT_FILE_PATH 配置正确的路径"
        });
    }
});

const HTTP_PORT = process.env.HTTP_PORT
    ? parseInt(process.env.HTTP_PORT)
    : 3000;
const HOCUSPOCUS_PORT = process.env.HOCUSPOCUS_PORT
    ? parseInt(process.env.HOCUSPOCUS_PORT)
    : 3001;

// 启动 HTTP 服务器（用于 /run-merge 接口）
const httpServer = createServer(app);
httpServer.on("error", (err) => {
    console.error(`HTTP server 启动失败（${HTTP_PORT}）：`, err);
    process.exit(1);
});
httpServer.listen(HTTP_PORT, () => {
    console.log(`✓ HTTP server listening on http://localhost:${HTTP_PORT}`);
    console.log(`  - /run-merge endpoint available`);
});

// 启动 Hocuspocus WebSocket 服务器（用于协作）
new Hocuspocus({
    address: "0.0.0.0",
    port: HOCUSPOCUS_PORT,
    quiet: false
} as any);

console.log(
    `✓ Hocuspocus WebSocket server listening on ws://localhost:${HOCUSPOCUS_PORT}/collab`
);
console.log(`bat 文件路径: ${batPath}`);
console.log(`提示: 可以通过环境变量 BAT_FILE_PATH 配置 bat 文件路径`);
