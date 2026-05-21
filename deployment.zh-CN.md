# 部署指南

## Docker 部署

推荐使用 Docker Compose 在服务器上部署 emomind。

### 服务器要求

- Linux 服务器（推荐 Ubuntu 20.04+）
- 已安装 Docker 和 Docker Compose
- 域名 DNS 已指向服务器 IP
- Traefik 自动处理路由和 HTTPS 证书

### 部署步骤

**1. 准备服务器**

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
# 安装 Docker Compose
apt install docker-compose -y
```

**2. 上传项目文件到服务器**

```bash
scp -r emomind目录/* user@服务器IP:/root/code/emomind/
```

**3. 配置环境变量**

在服务器上复制并编辑 env 文件：

```bash
cd /root/code/emomind
cp .env.example .env
nano .env  # 填入真实的密码和密钥
```

`.env` 中必须修改的配置：
- `SECRET_KEY` — 生成一个 64 位随机字符串
- `POSTGRES_PASSWORD` — 数据库密码
- `FIRST_SUPERUSER_PASSWORD` — 管理员密码
- `DOMAIN` — 你的域名
- `DIFY_API_URL` — Dify API 地址（Windows Docker 下用宿主机 IP）
- `DIFY_AI_DOCTOR_API_KEY` — AI 心理医生 Dify API Key
- `DIFY_TEST_API_KEY` — 心理测评 Dify API Key
- `VITE_API_URL` — 前端 API 地址（生产环境用 `https://你的域名.com`）

**4. 启动服务**

```bash
docker compose up -d
```

**5. 初始化数据库**

```bash
docker compose exec backend bash
# 在容器内执行：
alembic upgrade head
python app/initial_data.py
exit
```

**6. 设置管理员账号**

访问 `https://你的域名.com`，使用以下默认账号登录：
- 邮箱: `admin@example.com`
- 密码: `changethis`

登录后创建你自己的管理员账号，然后删除默认账号。

## Traefik 配置

项目中已包含 Traefik，自动处理 HTTPS（Let's Encrypt）。按上述步骤操作即可，无需额外配置。

## 更新版本

```bash
git pull
docker compose up -d --build
```

## 常用命令

```bash
# 查看日志
docker compose logs
docker compose logs backend

# 重启某个服务
docker compose restart backend

# 停止所有服务
docker compose down
```
