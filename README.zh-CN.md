# 全栈 FastAPI 模板

<a href="https://github.com/fastapi/full-stack-fastapi-template/actions?query=workflow%3A%22Test+Docker+Compose%22" target="_blank"><img src="https://github.com/fastapi/full-stack-fastapi-template/workflows/Test%20Docker%20Compose/badge.svg" alt="Test Docker Compose"></a>
<a href="https://github.com/fastapi/full-stack-fastapi-template/actions?query=workflow%3A%22Test+Backend%22" target="_blank"><img src="https://github.com/fastapi/full-stack-fastapi-template/workflows/Test%20Backend/badge.svg" alt="Test Backend"></a>
<a href="https://coverage-badge.samuelcolvin.workers.dev/redirect/fastapi/full-stack-fastapi-template" target="_blank"><img src="https://coverage-badge.samuelcolvin.workers.dev/fastapi/full-stack-fastapi-template.svg" alt="Coverage"></a>

## 技术栈和特性

- ⚡ [**FastAPI**](https://fastapi.tiangolo.com) - Python 后端 API
  - 🧰 [SQLModel](https://sqlmodel.tiangolo.com) - Python SQL 数据库交互 (ORM)
  - 🔍 [Pydantic](https://docs.pydantic.dev) - FastAPI 使用的数据验证和配置管理
  - 💾 [PostgreSQL](https://www.postgresql.org) - SQL 数据库
- 🚀 [React](https://react.dev) - 前端框架
  - 💃 使用 TypeScript、hooks、[Vite](https://vitejs.dev) 和现代前端技术栈
  - 🎨 [Tailwind CSS](https://tailwindcss.com) 和 [shadcn/ui](https://ui.shadcn.com) - 前端组件
  - 🤖 自动生成的前端客户端
  - 🧪 [Playwright](https://playwright.dev) - 端到端测试
  - 🦇 深色模式支持
- 🐋 [Docker Compose](https://www.docker.com) - 开发和生产环境
- 🔒 默认启用安全密码哈希
- 🔑 JWT (JSON Web Token) 认证
- 📫 基于邮箱的密码恢复
- 📬 [Mailcatcher](https://mailcatcher.me) - 本地邮件测试
- ✅ 使用 [Pytest](https://pytest.org) 进行测试
- 📞 [Traefik](https://traefik.io) - 反向代理/负载均衡
- 🚢 使用 Docker Compose 部署说明，包括如何设置前端 Traefik 代理处理自动 HTTPS 证书
- 🏭 基于 GitHub Actions 的 CI/CD 持续集成和持续部署

### 登录页面

[![API docs](img/login.png)](https://github.com/fastapi/full-stack-fastapi-template)

### 管理面板

[![API docs](img/dashboard.png)](https://github.com/fastapi/full-stack-fastapi-template)

### 项目页面

[![API docs](img/dashboard-items.png)](https://github.com/fastapi/full-stack-fastapi-template)

### 深色模式

[![API docs](img/dashboard-dark.png)](https://github.com/fastapi/full-stack-fastapi-template)

### 交互式 API 文档

[![API docs](img/docs.png)](https://github.com/fastapi/full-stack-fastapi-template)

## 如何使用

您可以直接 **fork 或 clone** 此仓库并按原样使用。

✨ 就是这么简单。✨

### 如何使用私有仓库

如果您想创建私有仓库，GitHub 不允许您直接 fork，因为不允许更改 fork 的可见性。

但您可以按以下步骤操作：

- 创建一个新的 GitHub 仓库，例如 `my-full-stack`
- 手动 clone 此仓库，并设置您想要的项目名称，例如 `my-full-stack`：

```bash
git clone git@github.com:fastapi/full-stack-fastapi-template.git my-full-stack
```

- 进入新目录：

```bash
cd my-full-stack
```

- 将新的 origin 设置为您的新仓库，从 GitHub 界面复制，例如：

```bash
git remote set-url origin git@github.com:octocat/my-full-stack.git
```

- 将此仓库添加为另一个"remote"，以便以后获取更新：

```bash
git remote add upstream git@github.com:fastapi/full-stack-fastapi-template.git
```

- 将代码推送到新仓库：

```bash
git push -u origin master
```

### 从原始模板更新

Clone 仓库并进行更改后，您可能需要从原始模板获取最新更改。

- 确保已将原始仓库添加为 remote，您可以使用以下命令检查：

```bash
git remote -v

origin    git@github.com:octocat/my-full-stack.git (fetch)
origin    git@github.com:octocat/my-full-stack.git (push)
upstream    git@github.com:fastapi/full-stack-fastapi-template.git (fetch)
upstream    git@github.com:fastapi/full-stack-fastapi-template.git (push)
```

- 拉取最新更改而不合并：

```bash
git pull --no-commit upstream master
```

这将下载此模板的最新更改而不提交，以便您在提交之前检查一切是否正确。

- 如果有冲突，请在编辑器中解决。

- 完成后，提交更改：

```bash
git merge --continue
```

### 配置

然后您可以更新 `.env` 文件中的配置来自定义您的设置。

部署之前，请确保至少更改以下值：

- `SECRET_KEY`
- `FIRST_SUPERUSER_PASSWORD`
- `POSTGRES_PASSWORD`

您可以（也应该）通过 secrets 传递这些环境变量。

更多详情请阅读 [deployment.zh-CN.md](./deployment.zh-CN.md) 文档。

### 生成密钥

`.env` 文件中的一些环境变量默认值是 `changethis`。

您必须用密钥替换它们，要生成密钥，您可以运行以下命令：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

复制内容并将其用作密码/密钥。然后再次运行以生成另一个安全密钥。

## 如何使用 - Copier 备选方案

此仓库还支持使用 [Copier](https://copier.readthedocs.io) 生成新项目。

它将复制所有文件，询问您配置问题，并使用您的答案更新 `.env` 文件。

### 安装 Copier

您可以使用以下方式安装 Copier：

```bash
pip install copier
```

或者更好，如果您有 [`pipx`](https://pipx.pypa.io/)，可以运行：

```bash
pipx install copier
```

**注意**：如果您有 `pipx`，安装 copier 是可选的，您可以直接运行它。

### 使用 Copier 生成项目

为新项目目录决定一个名称，您将在下面使用它。例如 `my-awesome-project`。

转到将成为项目父目录的目录，并使用项目名称运行命令：

```bash
copier copy https://github.com/fastapi/full-stack-fastapi-template my-awesome-project --trust
```

如果您有 `pipx` 但没有安装 `copier`，可以直接运行：

```bash
pipx run copier copy https://github.com/fastapi/full-stack-fastapi-template my-awesome-project --trust
```

**注意** `--trust` 选项是必要的，以便能够执行更新 `.env` 文件的[创建后脚本](https://github.com/fastapi/full-stack-fastapi-template/blob/master/.copier/update_dotenv.py)。

### 输入变量

Copier 会询问您一些数据，您可能需要在生成项目之前准备好。

但不用担心，之后您可以在 `.env` 文件中更新任何内容。

输入变量及其默认值（有些是自动生成的）：

- `project_name`: (默认: `"FastAPI Project"`) 项目名称，显示给 API 用户 (在 .env 中)
- `stack_name`: (默认: `"fastapi-project"`) 用于 Docker Compose 标签和项目名称的堆栈名称（无空格，无句点）(在 .env 中)
- `secret_key`: (默认: `"changethis"`) 项目的密钥，用于安全，存储在 .env 中，您可以使用上述方法生成
- `first_superuser`: (默认: `"admin@example.com"`) 第一个超级用户的邮箱 (在 .env 中)
- `first_superuser_password`: (默认: `"changethis"`) 第一个超级用户的密码 (在 .env 中)
- `smtp_host`: (默认: `""`) 用于发送邮件的 SMTP 服务器主机，您可以在 .env 中稍后设置
- `smtp_user`: (默认: `""`) 用于发送邮件的 SMTP 服务器用户，您可以在 .env 中稍后设置
- `smtp_password`: (默认: `""`) 用于发送邮件的 SMTP 服务器密码，您可以在 .env 中稍后设置
- `emails_from_email`: (默认: `"info@example.com"`) 用于发送邮件的邮箱账户，您可以在 .env 中稍后设置
- `postgres_password`: (默认: `"changethis"`) PostgreSQL 数据库的密码，存储在 .env 中，您可以使用上述方法生成一个
- `sentry_dsn`: (默认: `""`) Sentry 的 DSN，如果您使用它，可以在 .env 中稍后设置

## 后端开发

后端文档：[backend/README.zh-CN.md](./backend/README.zh-CN.md)

## 前端开发

前端文档：[frontend/README.zh-CN.md](./frontend/README.zh-CN.md)

## 部署

部署文档：[deployment.zh-CN.md](./deployment.zh-CN.md)

## 开发

通用开发文档：[development.zh-CN.md](./development.zh-CN.md)

包括使用 Docker Compose、自定义本地域名、`.env` 配置等。

## 发布说明

查看文件 [release-notes.zh-CN.md](./release-notes.zh-CN.md)

## 许可证

Full Stack FastAPI Template 根据 MIT 许可证的条款获得许可。
