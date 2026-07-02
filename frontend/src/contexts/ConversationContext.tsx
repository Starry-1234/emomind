import { useRouterState } from "@tanstack/react-router"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import useAuth from "@/hooks/useAuth"
import {
  type DifyConversation,
  deleteConversation,
  getConversations,
} from "@/services/difyApi"

// ── 模块类型 & 带类型的会话 ──────────────────────────────────────────────────
export type ConversationModuleType = "ai-doctor" | "test"

export interface TypedConversation extends DifyConversation {
  moduleType: ConversationModuleType
}

interface ChatConfig {
  apiKeyName: string
  storageKey: string
  basePath: string
  modulePath: string // 基础模块路由（如 /user/ai-doctor），区别于 basePath（/user/ai-doctor/chat）
}

const CONTEXT_CONFIGS: Record<string, ChatConfig> = {
  "ai-doctor": {
    apiKeyName: "ai-doctor",
    storageKey: "dify_active_conv_id",
    basePath: "/user/ai-doctor/chat",
    modulePath: "/user/ai-doctor",
  },
  test: {
    apiKeyName: "test",
    storageKey: "dify_active_conv_id_test",
    basePath: "/user/test/chat",
    modulePath: "/user/test",
  },
}

function getCurrentContext(pathname: string): ConversationModuleType {
  if (pathname.startsWith("/user/test")) return "test"
  return "ai-doctor"
}

export interface ConversationContextValue {
  conversations: DifyConversation[]
  allConversations: TypedConversation[]
  activeConvId: string
  loadConversations: () => Promise<void>
  loadAllConversations: () => Promise<void>
  selectConversation: (convId: string) => void
  selectConversationById: (
    convId: string,
    moduleType: ConversationModuleType,
  ) => void
  deleteConversationById: (convId: string) => Promise<void>
  newConversation: () => void
  setActiveConvId: (id: string) => void
  /** 新会话由 Dify API 创建后调用：设置 activeConvId + 刷新侧边栏 */
  onSessionCreated: (conversationId: string) => void
  apiKeyName: string
  basePath: string
  modulePath: string
  currentContext: ConversationModuleType
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const currentContext = getCurrentContext(currentPath)
  const config = CONTEXT_CONFIGS[currentContext]

  const { user } = useAuth()
  const userId = user?.id || "anonymous"

  // ── 两组独立状态（ai-doctor / test）─────────────────────────────────────────
  const [aiDoctorConversations, setAiDoctorConversations] = useState<
    DifyConversation[]
  >([])
  const [testConversations, setTestConversations] = useState<
    DifyConversation[]
  >([])

  const [aiDoctorActiveId, setAiDoctorActiveId] = useState(() => {
    return sessionStorage.getItem("dify_active_conv_id") || ""
  })
  const [testActiveId, setTestActiveId] = useState(() => {
    return sessionStorage.getItem("dify_active_conv_id_test") || ""
  })

  // ── 当前上下文的派生状态 ────────────────────────────────────────────────────
  const conversations =
    currentContext === "test" ? testConversations : aiDoctorConversations
  const activeConvId =
    currentContext === "test" ? testActiveId : aiDoctorActiveId

  // ── 统一会话列表：合并两模块，按 updated_at 降序 ────────────────────────────
  const allConversations: TypedConversation[] = useMemo(() => {
    const typed: TypedConversation[] = [
      ...aiDoctorConversations.map((c) => ({
        ...c,
        moduleType: "ai-doctor" as const,
      })),
      ...testConversations.map((c) => ({ ...c, moduleType: "test" as const })),
    ]
    return typed.sort((a, b) => b.updated_at - a.updated_at)
  }, [aiDoctorConversations, testConversations])

  // ── 设置 activeConvId（当前模块上下文）─────────────────────────────────────
  const setActiveConvId = useCallback(
    (id: string) => {
      if (currentContext === "test") {
        setTestActiveId(id)
      } else {
        setAiDoctorActiveId(id)
      }
      if (id) {
        sessionStorage.setItem(config.storageKey, id)
      } else {
        sessionStorage.removeItem(config.storageKey)
      }
    },
    [currentContext, config.storageKey],
  )

  // ── 跨模块选择会话：明确指定模块类型，避免 URL 上下文误导 ──────────────────
  const selectConversationById = useCallback(
    (convId: string, moduleType: ConversationModuleType) => {
      if (moduleType === "test") {
        setTestActiveId(convId)
        if (convId) {
          sessionStorage.setItem("dify_active_conv_id_test", convId)
        } else {
          sessionStorage.removeItem("dify_active_conv_id_test")
        }
      } else {
        setAiDoctorActiveId(convId)
        if (convId) {
          sessionStorage.setItem("dify_active_conv_id", convId)
        } else {
          sessionStorage.removeItem("dify_active_conv_id")
        }
      }
    },
    [],
  )

  // ── 加载当前模块会话列表（useChat / usePsychologicalTest 使用）─────────────
  const loadConversations = useCallback(async () => {
    try {
      const result = await getConversations(userId, {
        apiKeyName: config.apiKeyName,
      })
      if (currentContext === "test") {
        setTestConversations(result.data)
      } else {
        setAiDoctorConversations(result.data)
      }
    } catch (err) {
      console.error("加载会话列表失败:", err)
    }
  }, [userId, config.apiKeyName, currentContext])

  // ── 并行加载两模块会话列表（初始化 & 全量刷新）─────────────────────────────
  const loadAllConversations = useCallback(async () => {
    try {
      const [aiDoctorResult, testResult] = await Promise.all([
        getConversations(userId, { apiKeyName: "ai-doctor" }),
        getConversations(userId, { apiKeyName: "test" }),
      ])
      setAiDoctorConversations(aiDoctorResult.data)
      setTestConversations(testResult.data)
    } catch (err) {
      console.error("加载会话列表失败:", err)
    }
  }, [userId])

  // 挂载时加载全部会话
  useEffect(() => {
    loadAllConversations()
  }, [loadAllConversations])

  // ── 选择会话（当前模块上下文）───────────────────────────────────────────────
  const selectConversation = useCallback(
    (convId: string) => {
      setActiveConvId(convId)
    },
    [setActiveConvId],
  )

  // ── 删除会话（自动识别模块类型）─────────────────────────────────────────────
  const deleteConversationById = useCallback(
    async (convId: string) => {
      try {
        // 通过会话 ID 判断属于哪个模块
        const isTest = testConversations.some((c) => c.id === convId)
        const apiKeyForDelete = isTest ? "test" : "ai-doctor"

        await deleteConversation(convId, userId, apiKeyForDelete)

        // 清除该会话的 sessionStorage 消息缓存
        const chatCacheKey = `emomind_chat_messages_${userId}_${convId}`
        const testCacheKey = `emomind_test_messages_${userId}_${convId}`
        sessionStorage.removeItem(chatCacheKey)
        sessionStorage.removeItem(testCacheKey)
        // 同时清除基础路由缓存（防止删除后导航到基础路由时恢复脏数据）
        sessionStorage.removeItem(`emomind_chat_messages_${userId}_new`)
        sessionStorage.removeItem(`emomind_test_messages_${userId}_new`)

        // 刷新对应模块的列表 + 清理 activeConvId
        if (isTest) {
          const result = await getConversations(userId, { apiKeyName: "test" })
          setTestConversations(result.data)
          if (testActiveId === convId) {
            setTestActiveId("")
            sessionStorage.removeItem("dify_active_conv_id_test")
          }
        } else {
          const result = await getConversations(userId, {
            apiKeyName: "ai-doctor",
          })
          setAiDoctorConversations(result.data)
          if (aiDoctorActiveId === convId) {
            setAiDoctorActiveId("")
            sessionStorage.removeItem("dify_active_conv_id")
          }
        }
      } catch (err) {
        console.error("删除会话失败:", err)
        throw err
      }
    },
    [userId, testConversations, testActiveId, aiDoctorActiveId],
  )

  // ── 新会话创建回调（Dify API 返回真实 conversationId 后调用）───────────────
  const onSessionCreated = useCallback(
    (conversationId: string) => {
      setActiveConvId(conversationId)
      loadAllConversations()
    },
    [setActiveConvId, loadAllConversations],
  )

  // ── 新建会话（清空当前激活）─────────────────────────────────────────────────
  const newConversation = useCallback(() => {
    setActiveConvId("")
  }, [setActiveConvId])

  // ── 清理旧版 local-xxx 数据 ────────────────────────────────────────────────
  useEffect(() => {
    sessionStorage.removeItem(`${config.storageKey}_local`)
  }, [config.storageKey])

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        allConversations,
        activeConvId,
        loadConversations,
        loadAllConversations,
        selectConversation,
        selectConversationById,
        deleteConversationById,
        newConversation,
        setActiveConvId,
        onSessionCreated,
        apiKeyName: config.apiKeyName,
        basePath: config.basePath,
        modulePath: config.modulePath,
        currentContext,
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

/** 安全版：在 ConversationProvider 外使用时返回 null 而不抛异常 */
export function useOptionalConversation() {
  return useContext(ConversationContext)
}
