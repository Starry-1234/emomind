# FastAPI 项目 - 开发指南

## Docker Compose

* 使用 Docker Compose 启动本地堆栈：

```bash
docker compose watch
```

* 现在您可以打开浏览器并访问这些 URL：

使用 Docker 构建的前端，根据路径处理路由：<http://localhost:5173>

基于 JSON 的后端 Web API，基于 OpenAPI：<http://localhost:8000>

Swagger UI 自动交互式文档（来自 OpenAPI 后端）：<http://localhost:8000/docs>

Adminer，数据库 Web 管理：<http://localhost:8080>

Traefik UI，查看代理如何处理路由：<http://localhost:8090>

**注意**：首次启动堆栈时，可能需要一分钟时间准备。后端会等待数据库就绪并配置所有内容。您可以检查日志来监控。

要检查日志，请运行（在另一个终端中）：

```bash
docker compose logs
```

要检查特定服务的日志，请添加服务名称，例如：

```bash
docker compose logs backend
```

## Mailcatcher

Mailcatcher 是一个简单的 SMTP 服务器，用于捕获本地开发期间后端发送的所有邮件。不是发送真实邮件，而是捕获并在 Web 界面中显示。

这对于以下情况很有用：

* 开发期间测试邮件功能
* 验证邮件内容和格式
* 调试邮件相关功能而不发送真实邮件

当使用 Docker Compose 在本地运行时，后端自动配置为使用 Mailcatcher（SMTP 端口 1025）。所有捕获的邮件可以在 <http://localhost:1080> 查看。

## 本地开发

Docker Compose 文件配置为使每个服务在 `localhost` 的不同端口可用。

对于后端和前端，它们使用与本地开发服务器相同的端口，因此后端在 `http://localhost:8000`，前端在 `http://localhost:5173`。

这样，您可以关闭 Docker Compose 服务并启动其本地开发服务，一切都会继续正常工作，因为都使用相同的端口。

例如，您可以停止 Docker Compose 中的 `frontend` 服务，在另一个终端中运行：

```bash
docker compose stop frontend
```

然后启动本地前端开发服务器：

```bash
bun run dev
```

或者您可以停止 `backend` Docker Compose 服务：

```bash
docker compose stop backend
```

然后您可以运行后端的本地开发服务器：

```bash
cd backend
fastapi dev app/main.py
```

## Docker Compose 在 `localhost.tiangolo.com`

当您启动 Docker Compose 堆栈时，默认使用 `localhost`，每个服务使用不同的端口（后端、前端、adminer 等）。

当部署到生产环境（或预发布环境）时，它会将每个服务部署在不同的子域，例如后端的 `api.example.com` 和前端的 `dashboard.example.com`。

在[部署指南](deployment.zh-CN.md)中，您可以了解 Traefik 和配置的代理。这是负责根据子域将流量传输到每个服务的组件。

如果您想测试本地是否正常工作，可以编辑本地 `.env` 文件，更改：

```dotenv
DOMAIN=localhost.tiangolo.com
```

Docker Compose 文件将使用它来配置服务的基础域。

Traefik 将使用它将 `api.localhost.tiangolo.com` 的流量传输到后端，将 `dashboard.localhost.tiangolo.com` 的流量传输到前端。

域 `localhost.tiangolo.com` 是一个特殊域，配置为（及其所有子域）指向 `127.0.0.1`。这样您可以在本地开发中使用它。

更新后，再次运行：

```bash
docker compose watch
```

部署时，例如在生产环境中，主 Traefik 在 Docker Compose 文件外部配置。对于本地开发，`compose.override.yml` 中包含一个 Traefik，让您测试域是否按预期工作，例如 `api.localhost.tiangolo.com` 和 `dashboard.localhost.tiangolo.com`。

## Docker Compose 文件和环境变量

有一个包含适用于整个堆栈的所有配置的主 `compose.yml` 文件，它由 `docker compose` 自动使用。

还有一个 `compose.override.yml`，包含开发覆盖，例如将源代码挂载为卷。它由 `docker compose` 自动使用，以在 `compose.yml` 之上应用覆盖。

这些 Docker Compose 文件使用包含所有配置、生成的密钥和密码等的 `.env` 文件。

它们还使用在调用 `docker compose` 命令之前在脚本中设置的一些额外配置。

更改变量后，请确保重启堆栈：

```bash
docker compose watch
```

## .env 文件

`.env` 文件包含所有配置、生成的密钥和密码等。

根据您的工作流程，您可能希望将其从 Git 中排除，例如如果您的项目是公开的。在这种情况下，您必须确保为 CI 工具设置一种在构建或部署项目时获取它的方法。

一种方法是向 CI/CD 系统添加每个环境变量，并更新 `compose.yml` 文件以读取特定的 env 变量而不是读取 `.env` 文件。

## Pre-commit 和代码检查

我们使用一个名为 [prek](https://prek.j178.dev/) 的工具（[Pre-commit](https://pre-commit.com/) 的现代替代品）进行代码检查和格式化。

安装后，它会在 git 提交之前运行。这样可以确保代码在提交之前是一致的和格式化的。

您可以在项目根目录找到 `.pre-commit-config.yaml` 配置文件。

#### 安装 prek 自动运行

`prek` 已经是项目的依赖项。

安装 `prek` 工具并在本地仓库中"安装"后，您需要将其设置为在每次提交之前自动运行。

使用 `uv`，您可以执行以下操作（确保您在 `backend` 文件夹内）：

```bash
❯ uv run prek install -f
prek installed at `../.git/hooks/pre-commit`
```

`-f` 标志强制安装，以防之前已安装 `pre-commit` 钩子。

现在每当您尝试提交时，例如：

```bash
git commit
```

...prek 将运行并检查和格式化您即将提交的代码，并要求您再次添加（暂存）该代码（使用 git），然后才能提交。

然后您可以 `git add` 修改/修复的文件，现在可以提交了。

#### 手动运行 prek 钩子

您也可以手动对所有文件运行 `prek`，可以使用 `uv` 执行：

```bash
❯ uv run prek run --all-files
check for added large files..............................................Passed
check toml...............................................................Passed
check yaml...............................................................Passed
fix end of files.........................................................Passed
trim trailing whitespace.................................................Passed
ruff.....................................................................Passed
ruff-format..............................................................Passed
biome check..............................................................Passed
```

## URL

生产或预发布 URL 将使用相同的路径，但使用您自己的域名。

### 开发 URL

本地开发的开发 URL。

前端：<http://localhost:5173>

后端：<http://localhost:8000>

自动交互式文档（Swagger UI）：<http://localhost:8000/docs>

自动替代文档（ReDoc）：<http://localhost:8000/redoc>

Adminer：<http://localhost:8080>

Traefik UI：<http://localhost:8090>

MailCatcher：<http://localhost:1080>

### 配置了 `localhost.tiangolo.com` 的开发 URL

本地开发的开发 URL。

前端：<http://dashboard.localhost.tiangolo.com>

后端：<http://api.localhost.tiangolo.com>

自动交互式文档（Swagger UI）：<http://api.localhost.tiangolo.com/docs>

自动替代文档（ReDoc）：<http://api.localhost.tiangolo.com/redoc>

Adminer：<http://localhost.tiangolo.com:8080>

Traefik UI：<http://localhost.tiangolo.com:8090>

MailCatcher：<http://localhost.tiangolo.com:1080>
