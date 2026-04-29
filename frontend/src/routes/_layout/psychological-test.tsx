import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/psychological-test")({
  component: PsychologicalTest,
  head: () => ({
    meta: [
      {
        title: "心理测试 - 心理测评系统",
      },
    ],
  }),
})

export default function PsychologicalTest() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">在线心理测试</h1>
        <p className="text-muted-foreground">
          进行专业心理测评问卷
        </p>
      </div>
      <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">心理测试功能开发中...</p>
      </div>
    </div>
  )
}
