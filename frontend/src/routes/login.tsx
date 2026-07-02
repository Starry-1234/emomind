import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { LoginRequest } from "@/client"
import { ApiError, type UserResponse, UsersService } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

const formSchema = z.object({
  username: z.email(),
  password: z
    .string()
    .min(1, { message: "密码不能为空" })
    .min(8, { message: "密码至少8个字符" }),
}) satisfies z.ZodType<LoginRequest>

type FormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      let user: UserResponse | undefined
      try {
        user = await UsersService.getCurrentUser()
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          localStorage.removeItem("access_token")
        }
        return
      }
      if (user.is_superuser) {
        throw redirect({ to: "/admin" })
      }
      throw redirect({ to: "/user" })
    }
  },
  head: () => ({
    meta: [
      {
        title: "登录 - 心理测评系统",
      },
    ],
  }),
})

function Login() {
  const { loginMutation } = useAuth()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-foreground">
                    邮箱
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="user@example.com"
                      type="email"
                      className="border-input bg-secondary transition-colors focus-visible:border-primary focus-visible:ring-primary/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center">
                    <FormLabel className="text-xs font-medium text-foreground">
                      密码
                    </FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="ml-auto text-xs underline-offset-4 hover:underline text-muted-foreground hover:text-foreground"
                    >
                      忘记密码？
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="密码"
                      className="border-input bg-secondary transition-colors focus-visible:border-primary focus-visible:ring-primary/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={loginMutation.isPending}
              className="mt-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-md"
            >
              登录
            </LoadingButton>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            还没有账户？{" "}
            <RouterLink
              to="/signup"
              className="font-medium text-primary underline underline-offset-4 hover:text-accent"
            >
              注册
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
