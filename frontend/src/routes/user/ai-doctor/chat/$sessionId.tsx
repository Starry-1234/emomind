import { createFileRoute } from "@tanstack/react-router"
import { AiDoctor } from "../../ai-doctor"

export const Route = createFileRoute("/user/ai-doctor/chat/$sessionId")({
  component: AiDoctorChatRoute,
})

function AiDoctorChatRoute() {
  const { sessionId } = Route.useParams()
  return <AiDoctor sessionId={sessionId} />
}
