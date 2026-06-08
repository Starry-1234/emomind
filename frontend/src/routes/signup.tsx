import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
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

const formSchema = z
  .object({
    email: z.email(),
    full_name: z.string().min(1, { message: "姓名不能为空" }),
    password: z
      .string()
      .min(1, { message: "密码不能为空" })
      .min(8, { message: "密码至少8个字符" }),
    confirm_password: z.string().min(1, { message: "确认密码不能为空" }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "两次密码不一致",
    path: ["confirm_password"],
  })

type FormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/signup")({
  component: SignUp,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "注册 - 心理测评系统",
      },
    ],
  }),
})

export default function SignUp() {
  const { signUpMutation } = useAuth()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (signUpMutation.isPending) return

    const { confirm_password: _confirm_password, ...submitData } = data
    signUpMutation.mutate(submitData)
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
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-[#3d3d3d]">
                    姓名
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="full-name-input"
                      placeholder="请输入姓名"
                      type="text"
                      className="border-[#d9d3c9] bg-[#faf8f5] transition-colors focus-visible:border-[#2d4a3e] focus-visible:ring-[#2d4a3e]/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-[#3d3d3d]">
                    邮箱
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="user@example.com"
                      type="email"
                      className="border-[#d9d3c9] bg-[#faf8f5] transition-colors focus-visible:border-[#2d4a3e] focus-visible:ring-[#2d4a3e]/20"
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
                  <FormLabel className="text-xs font-medium text-[#3d3d3d]">
                    密码
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="密码"
                      className="border-[#d9d3c9] bg-[#faf8f5] transition-colors focus-visible:border-[#2d4a3e] focus-visible:ring-[#2d4a3e]/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-[#3d3d3d]">
                    确认密码
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      data-testid="confirm-password-input"
                      placeholder="请再次输入密码"
                      className="border-[#d9d3c9] bg-[#faf8f5] transition-colors focus-visible:border-[#2d4a3e] focus-visible:ring-[#2d4a3e]/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={signUpMutation.isPending}
              className="mt-1 bg-[#2d4a3e] text-[#f7f4ef] hover:bg-[#1f362c] transition-all hover:shadow-md"
            >
              注册
            </LoadingButton>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            已有账户？{" "}
            <RouterLink
              to="/login"
              className="font-medium text-[#2d4a3e] underline underline-offset-4 hover:text-[#c45a43]"
            >
              登录
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
