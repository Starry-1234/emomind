#!/bin/bash

cd "$(dirname "$0")/.."

echo "=== 停止 EmoMind 开发服务 ==="

# 停止前端
echo "[1/3] 停止前端..."
pkill -f "bun run dev" 2>/dev/null || true

# 停止后端
echo "[2/3] 停止后端..."
pkill -f "mvn spring-boot:run" 2>/dev/null || true

# 停止基础设施
echo "[3/3] 停止基础设施..."
docker compose down

echo ""
echo "=== 全部停止完成 ==="
