import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Clock,
  Inbox,
  MessageSquare,
  Search,
  User as UserIcon,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type UserPublic, UsersService } from "@/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  type DifyConversation,
  type DifyMessage,
  deleteConversation,
  getConversations,
  getMessages,
} from "@/services/difyApi"

export const Route = createFileRoute("/_admin-layout/chat-history")({
  component: ChatHistory,
  head: () => ({
    meta: [{ title: "会话历史管理" }],
  }),
})

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

/* ── Page ──────────────────────────────────────────── */

function ChatHistory() {
  const queryClient = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null)

  // 1) 用户列表
  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
  })

  const allUsers = (usersRes?.data || []).filter(
    (u: UserPublic) => !u.is_superuser,
  )
  const filteredUsers = allUsers.filter((u: UserPublic) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    )
  })

  const selectedUser = allUsers.find(
    (u: UserPublic) => u.id === selectedUserId,
  ) as UserPublic | undefined

  // 2) 会话列表
  const { data: convsRes, isLoading: convsLoading } = useQuery({
    queryKey: ["admin-conversations", selectedUserId],
    queryFn: () => getConversations(selectedUserId!, { limit: 50 }),
    enabled: !!selectedUserId,
  })

  const conversations = convsRes?.data || []

  // 3) 消息列表
  const { data: msgsRes, isLoading: msgsLoading } = useQuery({
    queryKey: ["admin-messages", selectedUserId, selectedConvId],
    queryFn: () =>
      getMessages(selectedUserId!, selectedConvId!, { limit: 100 }),
    enabled: !!selectedUserId && !!selectedConvId,
  })

  const messages = msgsRes?.data || []
  const selectedConv = conversations.find(
    (c: DifyConversation) => c.id === selectedConvId,
  ) as DifyConversation | undefined

  // 4) 删除会话
  const deleteMutation = useMutation({
    mutationFn: (convId: string) => deleteConversation(convId, selectedUserId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-conversations", selectedUserId],
      })
      if (selectedConvId === deleteConvId) {
        setSelectedConvId(null)
      }
      setDeleteConvId(null)
    },
  })

  const handleDeleteConv = () => {
    if (deleteConvId) {
      deleteMutation.mutate(deleteConvId)
    }
  }

  // 联动：切换用户时重置会话
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId)
    setSelectedConvId(null)
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* 三栏布局 */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden rounded-lg border bg-card">
        {/* ── 左栏：用户列表 ── */}
        <div className="flex w-56 flex-shrink-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">用户列表</span>
            </div>
            {filteredUsers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredUsers.length}
              </Badge>
            )}
          </div>
          <div className="p-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-3.5 w-3.5" />
              <Input
                placeholder="搜索用户..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 px-1">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                加载中...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <span>暂无用户</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredUsers.map((user: UserPublic) => (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors cursor-pointer ${
                      selectedUserId === user.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitial(user.full_name || user.email || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {user.full_name || "未命名用户"}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {user.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── 中栏：会话列表 ── */}
        <div className="flex w-64 flex-shrink-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-3 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">会话记录</span>
            </div>
            {conversations.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {conversations.length}
              </Badge>
            )}
          </div>
          {!selectedUserId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground">
              <UserIcon className="h-10 w-10" />
              <span>请先选择一个用户</span>
            </div>
          ) : (
            <>
              <div className="border-b px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  当前用户：
                  <span className="font-medium text-foreground">
                    {selectedUser?.full_name ||
                      selectedUser?.email ||
                      selectedUserId}
                  </span>
                </span>
              </div>
              <ScrollArea className="flex-1 px-1">
                {convsLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                    加载中...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground">
                    <Inbox className="h-8 w-8" />
                    <span>该用户暂无会话</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {conversations.map((conv: DifyConversation) => (
                      <div
                        key={conv.id}
                        className={`group relative rounded-md transition-colors ${
                          selectedConvId === conv.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full px-2.5 py-2.5 text-left cursor-pointer"
                          aria-label={`选择会话: ${conv.name || "未命名会话"}`}
                          onClick={() => setSelectedConvId(conv.id)}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium pr-6">
                              {conv.name || "未命名会话"}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(conv.updated_at || conv.created_at)}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConvId(conv.id)}
                          className="opacity-0 group-hover:opacity-100 absolute right-1.5 top-1.5 size-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        {/* ── 右栏：聊天消息 ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!selectedConvId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12" />
              <span className="text-sm">
                {!selectedUserId
                  ? "请先选择用户，再查看会话"
                  : "请选择一个会话查看详情"}
              </span>
            </div>
          ) : (
            <>
              {/* 会话头部 */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {selectedConv?.name || "未命名会话"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    创建于{" "}
                    {selectedConv ? formatTime(selectedConv.created_at) : ""}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {messages.length} 条消息
                </Badge>
              </div>

              {/* 消息列表 */}
              <MessageList messages={messages} isLoading={msgsLoading} />
            </>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={deleteConvId !== null}
        onOpenChange={(open) => !open && setDeleteConvId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除该会话？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConv}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ── 消息列表组件 ──────────────────────────────────── */

function MessageList({
  messages,
  isLoading,
}: {
  messages: DifyMessage[]
  isLoading: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        加载消息中...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        暂无消息记录
      </div>
    )
  }

  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at)

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      <div className="flex flex-col gap-3">
        {sorted.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.query ? "justify-end" : "justify-start"}`}
          >
            {msg.query && (
              <div className="max-w-[70%]">
                <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                  {msg.query}
                </div>
                <div className="mt-1 text-right text-[10px] text-muted-foreground">
                  用户 · {formatTime(msg.created_at)}
                </div>
              </div>
            )}
            {msg.answer && (
              <div className="max-w-[70%]">
                <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-foreground">
                  {msg.answer}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  AI · {formatTime(msg.created_at)}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
