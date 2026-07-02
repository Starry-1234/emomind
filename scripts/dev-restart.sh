#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== EmoMind 开发模式重启 ==="
echo ""

# 1. 停止现有服务
echo "[1/4] 停止现有服务..."
pkill -f "bun run dev" 2>/dev/null || true
pkill -f "mvn spring-boot:run" 2>/dev/null || true

# 2. 重建基础设施（重新读取 .env）
echo "[2/4] 重建基础设施..."
docker compose up -d --force-recreate db mailcatcher

# 3. 重新编译并启动后端
echo "[3/4] 编译并启动后端..."
cd backend-sb
set -a && source ../.env && set +a
mvn clean package -DskipTests
nohup mvn spring-boot:run > ../backend.log 2>&1 &
cd ..

# 等待后端就绪
echo "等待后端启动..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/utils/health-check/ | grep -q "200"; then
        echo "后端启动成功 ✓"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "后端启动超时，请查看 backend.log"
    fi
done

# 4. 启动前端
echo "[4/4] 启动前端..."
cd frontend
nohup bun run dev > ../frontend.log 2>&1 &
cd ..

echo ""
echo "=== 重启完成 ==="
echo "前端: http://localhost:5174"
echo "后端: http://localhost:8080"
echo ""
echo "查看日志: tail -f backend.log | tail -f frontend.log"
echo "停止服务: bash scripts/dev-stop.sh"
