import { createFileRoute } from "@tanstack/react-router"
import { PsychologicalTestInner } from "../test"

export const Route = createFileRoute("/user/test/")({
  component: () => <PsychologicalTestInner />,
})
