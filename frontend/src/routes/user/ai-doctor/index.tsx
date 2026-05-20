import { createFileRoute } from "@tanstack/react-router"
import { AiDoctor } from "../ai-doctor"

export const Route = createFileRoute("/user/ai-doctor/")({
  component: () => <AiDoctor />,
})
