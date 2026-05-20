import { createFileRoute } from "@tanstack/react-router"
import { PsychologicalTestInner } from "../../test"

export const Route = createFileRoute("/user/test/chat/$sessionId")({
  component: TestChatRoute,
})

function TestChatRoute() {
  const { sessionId } = Route.useParams()
  return <PsychologicalTestInner sessionId={sessionId} />
}
