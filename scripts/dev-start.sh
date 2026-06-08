#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== EmoMind 开发模式启动 ==="

# 1. 启动基础设施
echo "[1/3] 启动基础设施 (db, mailcatcher)..."
docker compose up -d db mailcatcher

# 2. 启动后端（后台运行，日志输出到 backend.log）
echo "[2/3] 启动后端..."
cd backend-sb
set -a && source ../.env && set +a
# 如果已经有后端进程在跑，先杀掉
pkill -f "mvn spring-boot:run" 2>/dev/null || true
nohup mvn spring-boot:run > ../backend.log 2>&1 &
cd ..

# 3. 等待后端就绪
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

# 4. 启动前端（后台运行，日志输出到 frontend.log）
echo "[3/3] 启动前端..."
cd frontend
# 如果已经有前端进程在跑，先杀掉
pkill -f "bun run dev" 2>/dev/null || true
nohup bun run dev > ../frontend.log 2>&1 &
cd ..

echo ""
echo "=== 全部启动完成 ==="
echo "前端:     http://localhost:5174"
echo "后端:     http://localhost:8080"
echo "Swagger:  http://localhost:8080/swagger-ui.html"
echo "Mail:     http://localhost:10801"
echo ""
echo "查看日志:"
echo "  后端日志: tail -f backend.log"
echo "  前端日志: tail -f frontend.log"
echo ""
echo "停止服务: bash scripts/dev-stop.sh"
