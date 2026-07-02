import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  type LoginRequest,
  AuthenticationService,
  type UserResponse,
  type UserRegisterRequest,
  UsersService,
} from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery<UserResponse | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.getCurrentUser,
    enabled: isLoggedIn(),
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegisterRequest) =>
      UsersService.signup({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const login = async (data: LoginRequest) => {
    const response = await AuthenticationService.login({
      request: data,
    })
    localStorage.setItem("access_token", response.access_token || "")
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      // 登录成功后获取用户信息，根据角色重定向
      const user = await UsersService.getCurrentUser()
      if (user.is_superuser) {
        navigate({ to: "/admin" })
      } else {
        navigate({ to: "/user" })
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
