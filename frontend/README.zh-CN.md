# 前端

## 技术栈

React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

## 启动

```bash
bun install
bun run dev
```

访问 http://localhost:5173

## 构建

```bash
bun run build
```

## 代码检查

```bash
bun run lint
```

## 端到端测试（Playwright）

需要先启动 Docker：

```bash
docker compose up -d backend
bunx playwright test
```

## 目录结构

```
src/
  main.tsx           # 应用入口
  routes/            # 页面组件
  components/        # UI 组件
  hooks/             # 自定义 hooks
  services/          # API 模块（difyApi、analysisApi）
  client/            # 自动生成的 OpenAPI 客户端
```

## 生成 API 客户端

后端接口变更后重新生成：

```bash
bash ./scripts/generate-client.sh
```
