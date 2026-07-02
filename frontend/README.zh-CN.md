# 前端

> **注意（emomind-lg / M0）**：本 README 从 `emomind-sb` 复制。前端的
> AI 集成正在从 `difyApi.ts` 迁移到 `langgraphApi.ts`（M5 阶段）。
> 在此之前，6 个 import 了 `difyApi` 的文件已被 neutralise，
> dev server 可能不能完整跑通。详见
> `doc/langgraph-migration/08-frontend-migration.md`。

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
  services/          # API 模块（langgraphApi [M5+]、analysisApi；difyApi 已 neutralise）
  client/            # 自动生成的 OpenAPI 客户端
```

## 生成 API 客户端

后端接口变更后重新生成：

```bash
bash ./scripts/generate-client.sh
```
