# FastAPI 项目 - 后端

## 需求

* [Docker](https://www.docker.com/)
* 用于 Python 包和环境管理的 [uv](https://docs.astral.sh/uv/)

## Docker Compose

按照 [../development.zh-CN.md](../development.zh-CN.md) 中的指南使用 Docker Compose 启动本地开发环境。

## 一般工作流程

默认情况下，依赖由 [uv](https://docs.astral.sh/uv/) 管理，请前往那里安装它。

从 `./backend/` 您可以使用以下方式安装所有依赖：

```console
$ uv sync
```

然后您可以使用以下方式激活虚拟环境：

```console
$ source .venv/bin/activate
```

确保您的编辑器使用正确的 Python 虚拟环境，解释器位于 `backend/.venv/bin/python`。

在 `./backend/app/models.py` 中修改或添加 SQLModel 模型用于数据和 SQL 表，在 `./backend/app/api/` 中修改 API 端点，在 `./backend/app/crud.py` 中修改 CRUD（创建、读取、更新、删除）工具。

## VS Code

已经有配置就位，可以通过 VS Code 调试器运行后端，这样您可以使用断点、暂停和探索变量等。

设置也已配置好，您可以通过 VS Code Python 测试选项卡运行测试。

## Docker Compose 覆盖

开发期间，您可以更改 Docker Compose 设置，这些设置仅影响本地开发环境，文件为 `compose.override.yml`。

对该文件的更改仅影响本地开发环境，不影响生产环境。因此，您可以添加有助于开发工作流程的"临时"更改。

例如，包含后端代码的目录在 Docker 容器中同步，将您更改的代码复制到容器内的目录中。这允许您立即测试更改，而不必再次构建 Docker 镜像。这应该只在开发期间完成，对于生产环境，您应该使用后端代码的最近版本构建 Docker 镜像。但在开发期间，它允许您非常快速地迭代。

还有一个命令覆盖，运行 `fastapi run --reload` 而不是默认的 `fastapi run`。它启动单个服务器进程（而不是像生产环境那样的多个进程），并在代码更改时重新加载进程。请注意，如果您有语法错误并保存 Python 文件，它会中断并退出，容器会停止。之后，您可以通过修复错误并再次运行来重启容器：

```console
$ docker compose watch
```

还有一个注释掉的 `command` 覆盖，您可以取消注释并注释掉默认的命令。它使后端容器运行一个"什么都不做"的进程，但保持容器活着。这允许您进入运行中的容器并在其中执行命令，例如测试已安装依赖的 Python 解释器，或启动在检测到更改时重新加载的开发服务器。

要使用 `bash` 会话进入容器，您可以启动堆栈：

```console
$ docker compose watch
```

然后在另一个终端，`exec` 进入运行中的容器：

```console
$ docker compose exec backend bash
```

您应该看到类似这样的输出：

```console
root@7f2607af31c3:/app#
```

这意味着您在容器内处于 `bash` 会话中，作为 `root` 用户，在 `/app` 目录下，该目录下有一个名为 "app" 的目录，这就是您的代码在容器内的位置：`/app/app`。

在那里您可以使用 `fastapi run --reload` 命令运行调试实时重新加载服务器。

```console
$ fastapi run --reload app/main.py
```

...它看起来像：

```console
root@7f2607af31c3:/app# fastapi run --reload app/main.py
```

然后按回车。这将运行实时重新加载服务器，当检测到代码更改时会自动重新加载。

然而，如果它没有检测到更改但有语法错误，它会因错误而停止。但由于容器仍然活着，而您在 Bash 会话中，您可以在修复错误后快速重启，运行相同的命令（"上箭头"和"回车"）。

...这个之前的细节就是为什么让容器活着什么都不做然后在 Bash 会话中让它运行实时重新加载服务器是有用的。

## 后端测试

要测试后端，请运行：

```console
$ bash ./scripts/test.sh
```

测试使用 Pytest 运行，在 `./backend/tests/` 中修改和添加测试。

如果您使用 GitHub Actions，测试会自动运行。

### 测试运行堆栈

如果您的堆栈已经启动并且您只想运行测试，您可以使用：

```bash
docker compose exec backend bash scripts/tests-start.sh
```

`/app/scripts/tests-start.sh` 脚本只是调用 `pytest`，确保堆栈的其余部分正在运行。如果您需要将额外参数传递给 `pytest`，您可以将它们传递给该命令，它们将被转发。

例如，要第一次错误时停止：

```bash
docker compose exec backend bash scripts/tests-start.sh -x
```

### 测试覆盖率

当测试运行时，会生成一个文件 `htmlcov/index.html`，您可以在浏览器中打开它来查看测试的覆盖率。

## 迁移

由于在本地开发期间您的应用目录作为卷挂载在容器中，您也可以在容器内运行 `alembic` 命令运行迁移，迁移代码将在您的应用目录中（而不是仅在容器内）。所以您可以将其添加到 git 仓库。

确保为您的模型创建一个"修订"，并且每次更改时都使用该修订"升级"您的数据库。因为这将更新数据库中的表。否则，您的应用程序将出错。

* 在后端容器中启动交互式会话：

```console
$ docker compose exec backend bash
```

* Alembic 已配置为从 `./backend/app/models.py` 导入您的 SQLModel 模型。

* 在容器内，更改模型（例如添加列）后，创建一个修订，例如：

```console
$ alembic revision --autogenerate -m "Add column last_name to User model"
```

* 将 alembic 目录中生成的文件提交到 git 仓库。

* 创建修订后，在数据库中运行迁移（这才是真正更改数据库的）：

```console
$ alembic upgrade head
```

如果您根本不想使用迁移，请在 `./backend/app/core/db.py` 中取消注释以下行：

```python
SQLModel.metadata.create_all(engine)
```

并注释掉 `scripts/prestart.sh` 中包含以下内容的行：

```console
$ alembic upgrade head
```

如果您不想从默认模型开始，想从一开始移除/修改它们，没有任何先前的修订，您可以删除 `./backend/app/alembic/versions/` 下的修订文件（`.py` Python 文件）。然后按照上述方式创建第一个迁移。

## 邮件模板

邮件模板位于 `./backend/app/email-templates/`。这里有两个目录：`build` 和 `src`。`src` 目录包含用于构建最终邮件模板的源文件。`build` 目录包含应用程序使用的最终邮件模板。

在继续之前，确保在您的 VS Code 中安装了 [MJML 扩展](https://github.com/mjmlio/vscode-mjml)。

安装 MJML 扩展后，您可以在 `src` 目录中创建新的邮件模板。创建新的邮件模板并在编辑器中打开 `.mjml` 文件后，打开命令面板 `Ctrl+Shift+P` 并搜索 `MJML: Export to HTML`。这会将 `.mjml` 文件转换为 `.html` 文件，现在您可以将其保存到 build 目录。
