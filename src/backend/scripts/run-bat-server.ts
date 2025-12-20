import express, { Request, Response } from "express";
import cors from "cors";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { access } from "fs/promises";

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
            ["/k", batPath], // /c 参数表示执行命令后关闭 cmd
            {
                encoding: "utf8" as const, // 指定编码为 utf8
                windowsHide: false, // 显示 cmd 窗口
                timeout: 5 * 60 * 1000, // 超时时间：5分钟（防止批处理无限运行）
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

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(PORT, () => {
    console.log(`run-bat-server listening http://localhost:${PORT}`);
    console.log(`bat 文件路径: ${batPath}`);
    console.log(`提示: 可以通过环境变量 BAT_FILE_PATH 配置 bat 文件路径`);
});
