import { createFileRoute, redirect } from "@tanstack/react-router"
import { ApiError, UsersService } from "@/client"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/")({
  component: Index,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      // 未登录用户重定向到登录页
      throw redirect({
        to: "/login",
      })
    }
    try {
      // 已登录用户根据角色重定向
      const user = await UsersService.readUserMe()
      if (user.is_superuser) {
        throw redirect({ to: "/admin" })
      }
      throw redirect({ to: "/user" })
    } catch (error) {
      // 仅当认证失败时才清除 token
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        localStorage.removeItem("access_token")
      }
      throw redirect({ to: "/login" })
    }
  },
})

function Index() {
  // 这个组件不会渲染，因为 beforeLoad 会重定向
  return null
}
