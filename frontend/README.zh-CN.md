# FastAPI 项目 - 前端

前端使用 [Vite](https://vitejs.dev/)、[React](https://reactjs.org/)、[TypeScript](https://www.typescriptlang.org/)、[TanStack Query](https://tanstack.com/query)、[TanStack Router](https://tanstack.com/router) 和 [Tailwind CSS](https://tailwindcss.com/) 构建。

## 需求

- [Bun](https://bun.sh/)（推荐）或 [Node.js](https://nodejs.org/)

## 快速开始

```bash
bun install
bun run dev
```

* 然后在浏览器中打开 <http://localhost:5173/>

请注意，这个实时服务器不在 Docker 内运行，它用于本地开发，这是推荐的工作流程。一旦您对前端满意，就可以构建前端 Docker 镜像并启动它，在类似生产的环境中测试它。但每次更改都构建镜像不会像使用实时重新加载运行本地开发服务器那样高效。

检查 `package.json` 文件以查看其他可用选项。

### 移除前端

如果您正在开发仅 API 的应用并想移除前端，您可以轻松完成：

* 删除 `./frontend` 目录。

* 在 `compose.yml` 文件中，删除整个服务/部分 `frontend`。

* 在 `compose.override.yml` 文件中，删除整个服务/部分 `frontend` 和 `playwright`。

完成，您有了一个无前端（仅 API）的应用。🤓

---

如果需要，您也可以从以下位置移除 `FRONTEND` 环境变量：

* `.env`
* `./scripts/*.sh`

但这只是清理它们，保留它们实际上也不会有任何影响。

## 生成客户端

### 自动生成

* 激活后端虚拟环境。
* 从项目顶层目录运行脚本：

```bash
bash ./scripts/generate-client.sh
```

* 提交更改。

### 手动生成

* 启动 Docker Compose 堆栈。

* 从 `http://localhost/api/v1/openapi.json` 下载 OpenAPI JSON 文件，并将其复制到 `frontend` 目录根目录下的新文件 `openapi.json`。

* 要生成前端客户端，运行：

```bash
bun run generate-client
```

* 提交更改。

请注意，每次后端更改（更改 OpenAPI schema）时，您应该再次遵循这些步骤来更新前端客户端。

## 使用远程 API

如果您想使用远程 API，您可以设置环境变量 `VITE_API_URL` 为远程 API 的 URL。例如，您可以在 `frontend/.env` 文件中设置：

```env
VITE_API_URL=https://api.my-domain.example.com
```

然后，当您运行前端时，它将使用该 URL 作为 API 的基础 URL。

## 代码结构

前端代码结构如下：

* `frontend/src` - 主前端代码
* `frontend/src/assets` - 静态资源
* `frontend/src/client` - 生成的 OpenAPI 客户端
* `frontend/src/components` - 前端的不同组件
* `frontend/src/hooks` - 自定义 hooks
* `frontend/src/routes` - 前端的不同路由，包括页面

## 使用 Playwright 进行端到端测试

前端包括使用 Playwright 的初始端到端测试。要运行测试，您需要运行 Docker Compose 堆栈。使用以下命令启动堆栈：

```bash
docker compose up -d --wait backend
```

然后，您可以使用以下命令运行测试：

```bash
bunx playwright test
```

您也可以在 UI 模式下运行测试，查看浏览器并与之交互：

```bash
bunx playwright test --ui
```

要停止并移除 Docker Compose 堆栈并清理测试中创建的数据，使用以下命令：

```bash
docker compose down -v
```

要更新测试，请导航到测试目录并根据需要修改现有测试文件或添加新测试。

有关编写和运行 Playwright 测试的更多信息，请参阅官方 [Playwright 文档](https://playwright.dev/docs/intro)。
