import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        // SSE 流式响应需要禁用缓冲，防止 chunked encoding 不完整
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes, req, res) => {
            const contentType = proxyRes.headers["content-type"] || ""
            if (
              typeof contentType === "string" &&
              contentType.includes("text/event-stream")
            ) {
              // 禁用 Nginx 类缓冲（如果前面有 Nginx）
              proxyRes.headers["X-Accel-Buffering"] = "no"
              // 确保不缓存
              proxyRes.headers["Cache-Control"] = "no-cache"
              proxyRes.headers["Connection"] = "keep-alive"
            }
          })
        },
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
})
