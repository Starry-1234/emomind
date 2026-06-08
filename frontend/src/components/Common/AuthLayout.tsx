import { motion } from "framer-motion"
import { Appearance } from "@/components/Common/Appearance"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * 心理主题登录布局 —— 静水涟漪（Framer Motion 版）
 *
 * 设计概念：
 * - 背景随主题变化，象征安静、安全的心理空间
 * - 背景是明显的水波涟漪，缓缓扩散、循环往复
 * - 中央卡片是稳定的锚点，给人归属感
 * - 所有文字使用清晰可读的深色调
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-6 py-12">
      {/* 宣纸纹理 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Framer Motion 水波涟漪 —— 多层同心圆环 */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: `${280 + i * 140}px`,
              height: `${280 + i * 140}px`,
              marginLeft: `-${(280 + i * 140) / 2}px`,
              marginTop: `-${(280 + i * 140) / 2}px`,
              boxShadow: "0 0 0 3px var(--ripple-color)",
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: [0.6, 1.5],
              opacity: [0, 0.5, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 1.2,
            }}
          />
        ))}
      </div>

      {/* 中心稳定点 —— 呼吸效果 */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, var(--ripple-center) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* 主题切换 */}
      <div className="absolute right-6 top-6 z-20">
        <Appearance />
      </div>

      {/* 中央卡片 */}
      <motion.div
        className="relative z-10 w-full max-w-[400px]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="rounded-xl bg-card p-10 sm:p-12"
          style={{ boxShadow: "0 4px 24px var(--card-shadow)" }}
        >
          {/* 卡片顶部装饰 —— 波浪线 */}
          <div className="mb-8 flex justify-center">
            <svg
              width="48"
              height="12"
              viewBox="0 0 48 12"
              fill="none"
              className="text-primary/30"
            >
              <path
                d="M2 6C6 2 10 2 14 6C18 10 22 10 26 6C30 2 34 2 38 6C42 10 46 10 46 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* 品牌区 */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <h1 className="font-serif-zh text-3xl font-semibold tracking-wide text-foreground">
              情之所至
            </h1>
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              关照内心，从此刻开始
            </p>
          </div>

          {/* 表单 */}
          <div className="relative">{children}</div>

          {/* 底部小字 */}
          <div className="mt-8 text-center">
            <p className="text-[11px] tracking-widest text-muted-foreground">
              倾听 · 觉察 · 接纳
            </p>
          </div>
        </div>
      </motion.div>

      {/* 底部版权 */}
      <div className="absolute bottom-6 z-10">
        <Footer noBorder />
      </div>
    </div>
  )
}
