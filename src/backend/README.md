# 后端服务说明

## 功能
后端服务用于执行本地的 bat 文件，当前用于"融合解析"功能。

## 启动方式

### 方式一：单独启动后端服务
```bash
pnpm run-bat-server
```

### 方式二：同时启动前端和后端服务
```bash
pnpm dev:all
```

## 配置

### BAT 文件路径配置

可以通过环境变量 `BAT_FILE_PATH` 来配置 bat 文件的路径：

#### Windows (PowerShell)
```powershell
$env:BAT_FILE_PATH="F:/path/to/your/file.bat"
pnpm run-bat-server
```

#### Windows (CMD)
```cmd
set BAT_FILE_PATH=F:\path\to\your\file.bat
pnpm run-bat-server
```

#### Linux/Mac
```bash
export BAT_FILE_PATH="/path/to/your/file.bat"
pnpm run-bat-server
```

如果不设置环境变量，默认路径为：`../../../../Fusion-Analysis/system-start.bat`（相对于后端脚本文件）

### 端口配置

可以通过环境变量 `PORT` 来配置后端服务端口（默认：3001）：

```bash
PORT=3002 pnpm run-bat-server
```

## API

### POST /run-merge

执行 bat 文件。

**请求：**
```http
POST /run-merge
Content-Type: application/json
```

**成功响应：**
```json
{
  "success": true,
  "stdout": "输出内容",
  "stderr": "错误输出",
  "message": "批处理执行成功"
}
```

**失败响应：**
```json
{
  "success": false,
  "error": "错误信息",
  "message": "错误描述"
}
```

## 注意事项

1. 后端服务默认运行在 `http://localhost:3001`
2. Vite 开发服务器已配置代理，将 `/run-merge` 请求转发到后端服务
3. 确保 bat 文件路径正确，否则会返回 404 错误
4. bat 文件执行超时时间为 5 分钟
5. 执行 bat 文件时会隐藏 cmd 窗口（windowsHide: true）

