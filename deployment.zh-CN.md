# FastAPI 项目 - 部署指南

您可以使用 Docker Compose 将项目部署到远程服务器。

此项目期望您有一个 Traefik 代理来处理与外界的通信和 HTTPS 证书。

您可以使用 CI/CD（持续集成和持续部署）系统自动部署，已有配置可以使用 GitHub Actions 来实现。

但您需要先配置一些东西。🤓

## 准备工作

* 准备一台远程服务器并使其可用。
* 配置域名的 DNS 记录指向您刚创建的服务器的 IP。
* 为您的域名配置通配符子域，以便您可以为不同的服务使用多个子域，例如 `*.fastapi-project.example.com`。这将有助于访问不同的组件，如 `dashboard.fastapi-project.example.com`、`api.fastapi-project.example.com`、`traefik.fastapi-project.example.com`、`adminer.fastapi-project.example.com` 等。也适用于 `staging`，如 `dashboard.staging.fastapi-project.example.com`、`adminer.staging.fastapi-project.example.com` 等。
* 在远程服务器上安装和配置 [Docker](https://docs.docker.com/engine/install/)（Docker Engine，不是 Docker Desktop）。

## 公共 Traefik

我们需要 Traefik 代理来处理传入连接和 HTTPS 证书。

您只需要执行这些下一步一次。

### Traefik Docker Compose

* 创建一个远程目录来存储您的 Traefik Docker Compose 文件：

```bash
mkdir -p /root/code/traefik-public/
```

将 Traefik Docker Compose 文件复制到您的服务器。您可以通过在本地终端运行 `rsync` 命令来执行：

```bash
rsync -a compose.traefik.yml root@your-server.example.com:/root/code/traefik-public/
```

### Traefik 公共网络

此 Traefik 期望一个名为 `traefik-public` 的 Docker"公共网络"来与您的堆栈通信。

这样，将有一个处理与外界通信（HTTP 和 HTTPS）的单一公共 Traefik 代理，然后在其后面，您可以拥有一个或多个具有不同域的堆栈，即使它们在同一台服务器上。

要创建名为 `traefik-public` 的 Docker"公共网络"，请在远程服务器上运行以下命令：

```bash
docker network create traefik-public
```

### Traefik 环境变量

Traefik Docker Compose 文件期望在启动之前在您的终端中设置一些环境变量。您可以通过在远程服务器上运行以下命令来设置。

* 创建 HTTP Basic Auth 的用户名，例如：

```bash
export USERNAME=admin
```

* 创建一个包含 HTTP Basic Auth 密码的环境变量，例如：

```bash
export PASSWORD=changethis
```

* 使用 openssl 生成 HTTP Basic Auth 密码的"哈希"版本并将其存储在环境变量中：

```bash
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
```

要验证哈希密码是否正确，您可以打印它：

```bash
echo $HASHED_PASSWORD
```

* 创建一个包含服务器域名的环境变量，例如：

```bash
export DOMAIN=fastapi-project.example.com
```

* 创建一个包含 Let's Encrypt 邮箱的环境变量，例如：

```bash
export EMAIL=admin@example.com
```

**注意**：您需要设置一个不同的邮箱，`@example.com` 的邮箱不起作用。

### 启动 Traefik Docker Compose

转到远程服务器上复制 Traefik Docker Compose 文件的目录：

```bash
cd /root/code/traefik-public/
```

现在环境变量已设置，`compose.traefik.yml` 已就位，您可以通过运行以下命令启动 Traefik Docker Compose：

```bash
docker compose -f compose.traefik.yml up -d
```

## 部署 FastAPI 项目

现在 Traefik 已就位，您可以使用 Docker Compose 部署您的 FastAPI 项目。

**注意**：您可能想跳到关于 GitHub Actions 持续部署的部分。

## 复制代码

```bash
rsync -av --filter=":- .gitignore" ./ root@your-server.example.com:/root/code/app/
```

注意：`--filter=":- .gitignore"` 告诉 `rsync` 使用与 git 相同的规则，忽略被 git 忽略的文件，如 Python 虚拟环境。

## 环境变量

您需要先设置一些环境变量。

### 生成密钥

`.env` 文件中的一些环境变量默认值是 `changethis`。

您必须用密钥替换它们，要生成密钥，您可以运行以下命令：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

复制内容并将其用作密码/密钥。然后再次运行以生成另一个安全密钥。

### 必需的环境变量

设置 `ENVIRONMENT`，默认为 `local`（用于开发），但部署到服务器时您可以放置 `staging` 或 `production`：

```bash
export ENVIRONMENT=production
```

设置 `DOMAIN`，默认为 `localhost`（用于开发），但部署时您将使用您自己的域名，例如：

```bash
export DOMAIN=fastapi-project.example.com
```

设置 `POSTGRES_PASSWORD` 为 `changethis` 以外的值：

```bash
export POSTGRES_PASSWORD="changethis"
```

设置 `SECRET_KEY`，用于签名令牌：

```bash
export SECRET_KEY="changethis"
```

注意：您可以使用上面的 Python 命令生成安全的密钥。

设置 `FIRST_SUPER_USER_PASSWORD` 为 `changethis` 以外的值：

```bash
export FIRST_SUPERUSER_PASSWORD="changethis"
```

设置 `BACKEND_CORS_ORIGINS` 以包含您的域名：

```bash
export BACKEND_CORS_ORIGINS="https://dashboard.${DOMAIN?Variable not set},https://api.${DOMAIN?Variable not set}"
```

您可以设置其他几个环境变量：

* `PROJECT_NAME`：项目名称，用于 API 文档和邮件。
* `STACK_NAME`：用于 Docker Compose 标签和项目名称的堆栈名称，`staging`、`production` 等应该不同。您可以使用相同的域名，将点替换为破折号，例如 `fastapi-project-example-com` 和 `staging-fastapi-project-example-com`。
* `BACKEND_CORS_ORIGINS`：逗号分隔的允许 CORS 源列表。
* `FIRST_SUPERUSER`：第一个超级用户的邮箱，此超级用户将是可以创建新用户的用户。
* `SMTP_HOST`：用于发送邮件的 SMTP 服务器主机，这来自您的邮件提供商（例如 Mailgun、Sparkpost、Sendgrid 等）。
* `SMTP_USER`：用于发送邮件的 SMTP 服务器用户。
* `SMTP_PASSWORD`：用于发送邮件的 SMTP 服务器密码。
* `EMAILS_FROM_EMAIL`：用于发送邮件的邮箱账户。
* `POSTGRES_SERVER`：PostgreSQL 服务器的主机名。您可以保留默认值 `db`，由同一个 Docker Compose 提供。除非您使用第三方提供商，否则通常不需要更改。
* `POSTGRES_PORT`：PostgreSQL 服务器的端口。您可以保留默认值。除非您使用第三方提供商，否则通常不需要更改。
* `POSTGRES_USER`：Postgres 用户，您可以保留默认值。
* `POSTGRES_DB`：此应用程序使用的数据库名称。您可以保留默认值 `app`。
* `SENTRY_DSN`：Sentry 的 DSN，如果您使用它的话。

## GitHub Actions 环境变量

有一些仅由 GitHub Actions 使用的环境变量，您可以配置：

* `LATEST_CHANGES`：由 GitHub Action [latest-changes](https://github.com/tiangolo/latest-changes) 使用，根据合并的 PR 自动添加发布说明。这是一个个人访问令牌，请阅读文档了解详情。
* `SMOKESHOW_AUTH_KEY`：用于使用 [Smokeshow](https://github.com/samuelcolvin/smokeshow) 处理和发布代码覆盖率，请遵循他们的说明创建一个（免费的）Smokeshow 密钥。

### 使用 Docker Compose 部署

环境变量到位后，您可以使用 Docker Compose 部署：

```bash
cd /root/code/app/
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

对于生产环境，您不需要 `compose.override.yml` 中的覆盖，这就是为什么我们明确指定使用 `compose.yml` 作为要使用的文件。

## 持续部署 (CD)

您可以使用 GitHub Actions 自动部署您的项目。😎

您可以拥有多个环境部署。

已经配置了两个环境，`staging` 和 `production`。🚀

### 安装 GitHub Actions Runner

* 在您的远程服务器上，为您的 GitHub Actions 创建一个用户：

```bash
sudo adduser github
```

* 将 Docker 权限添加到 `github` 用户：

```bash
sudo usermod -aG docker github
```

* 临时切换到 `github` 用户：

```bash
sudo su - github
```

* 进入 `github` 用户的主目录：

```bash
cd
```

* [按照官方指南安装 GitHub Action self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners#adding-a-self-hosted-runner-to-a-repository)。

* 当询问标签时，添加一个环境标签，例如 `production`。您也可以稍后添加标签。

安装后，指南会告诉您运行命令来启动 runner。但是，一旦您终止该进程或失去与服务器的本地连接，它就会停止。

为确保它在启动时运行并继续运行，您可以将其安装为服务。要做到这一点，退出 `github` 用户并返回 `root` 用户：

```bash
exit
```

完成后，您将再次使用前一个用户。并且您将在属于该用户的前一个目录中。

在能够进入 `github` 用户目录之前，您需要成为 `root` 用户（您可能已经是）：

```bash
sudo su
```

* 作为 `root` 用户，进入 `github` 用户主目录中的 `actions-runner` 目录：

```bash
cd /home/github/actions-runner
```

* 使用用户 `github` 将 self-hosted runner 安装为服务：

```bash
./svc.sh install github
```

* 启动服务：

```bash
./svc.sh start
```

* 检查服务状态：

```bash
./svc.sh status
```

您可以在官方指南中阅读更多内容：[将 self-hosted runner 应用程序配置为服务](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service)。

### 设置 Secrets

在您的仓库中，为您需要的环境变量配置 secrets，包括 `SECRET_KEY` 等。按照[设置仓库 secrets 的官方 GitHub 指南](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository)。

当前的 GitHub Actions 工作流程期望这些 secrets：

* `DOMAIN_PRODUCTION`
* `DOMAIN_STAGING`
* `STACK_NAME_PRODUCTION`
* `STACK_NAME_STAGING`
* `EMAILS_FROM_EMAIL`
* `FIRST_SUPERUSER`
* `FIRST_SUPERUSER_PASSWORD`
* `POSTGRES_PASSWORD`
* `SECRET_KEY`
* `LATEST_CHANGES`
* `SMOKESHOW_AUTH_KEY`

## GitHub Action 部署工作流程

`.github/workflows` 目录中有 GitHub Action 工作流程，已配置为部署到环境（具有标签的 GitHub Actions runner）：

* `staging`：推送到（或合并到）`master` 分支后
* `production`：发布 release 后

如果需要添加额外环境，您可以使用这些作为起点。

## URL

将 `fastapi-project.example.com` 替换为您的域名。

### 主 Traefik 仪表板

Traefik UI：`https://traefik.fastapi-project.example.com`

### 生产环境

前端：`https://dashboard.fastapi-project.example.com`

后端 API 文档：`https://api.fastapi-project.example.com/docs`

后端 API 基础 URL：`https://api.fastapi-project.example.com`

Adminer：`https://adminer.fastapi-project.example.com`

### 预发布环境

前端：`https://dashboard.staging.fastapi-project.example.com`

后端 API 文档：`https://api.staging.fastapi-project.example.com/docs`

后端 API 基础 URL：`https://api.staging.fastapi-project.example.com`

Adminer：`https://adminer.staging.fastapi-project.example.com`
