interface FooterProps {
  noBorder?: boolean
}

export function Footer({ noBorder = false }: FooterProps) {
  return (
    <footer className={`py-2 px-6 ${noBorder ? "" : "border-t"}`}>
      <div className="flex justify-center">
        <p className="text-center text-[11px] tracking-wide text-muted-foreground/70">
          情之所至 — 基于多模态大模型融合分析的心理动态监测系统
        </p>
      </div>
    </footer>
  )
}
