import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import useAuth from "@/hooks/useAuth"
import {
  type DifyConversation,
  deleteConversation,
  getConversations,
} from "@/services/difyApi"

interface ConversationContextValue {
  conversations: DifyConversation[]
  activeConvId: string
  loadConversations: () => Promise<void>
  selectConversation: (convId: string) => void
  deleteConversationById: (convId: string) => Promise<void>
  newConversation: () => void
  setActiveConvId: (id: string) => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id || "anonymous"

  const [conversations, setConversations] = useState<DifyConversation[]>([])
  const [activeConvId, setActiveConvId] = useState("")

  const loadConversations = useCallback(async () => {
    try {
      const result = await getConversations(userId)
      setConversations(result.data)
    } catch (err) {
      console.error("加载会话列表失败:", err)
    }
  }, [userId])

  // userId 变化时（包括 user 从 null 变为真实用户）重新加载会话列表
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const selectConversation = useCallback((convId: string) => {
    setActiveConvId(convId)
  }, [])

  const deleteConversationById = useCallback(
    async (convId: string) => {
      try {
        await deleteConversation(convId, userId)
        if (activeConvId === convId) {
          setActiveConvId("")
        }
        loadConversations()
      } catch {
        // silent
      }
    },
    [userId, activeConvId, loadConversations],
  )

  const newConversation = useCallback(() => {
    setActiveConvId("")
  }, [])

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConvId,
        loadConversations,
        selectConversation,
        deleteConversationById,
        newConversation,
        setActiveConvId,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversation() {
  const ctx = useContext(ConversationContext)
  if (!ctx) {
    throw new Error(
      "useConversation must be used within a ConversationProvider",
    )
  }
  return ctx
}
