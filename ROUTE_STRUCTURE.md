# 路由结构说明

## 当前路由结构（2026-04-14 重构后）

```
frontend/src/routes/
├── __root.tsx                    # 根路由，仅 <Outlet />
│
├── 认证页面（所有用户共用）
├── login.tsx                     # 登录页
├── signup.tsx                    # 注册页
├── recover-password.tsx          # 密码恢复
├── reset-password.tsx             # 重置密码
│
├── _admin-layout.tsx             # 管理员布局壳（左侧 Sidebar + 右侧内容区）
└── _admin-layout/
    └── admin.tsx                 # /admin 管理员首页
│
├── _user-layout.tsx              # 用户布局壳（顶部导航，完全独立于管理员）
└── _user-layout/
    └── user.tsx                  # /user 用户首页
```

## 路由守卫逻辑

### 认证流程
1. 未登录用户访问任何页面 → 重定向到 `/login`
2. 已登录用户访问 `/login` → 根据角色重定向（超管 → `/admin`，普通用户 → `/user`）

### 管理员路由 (`/admin/*`)
- 验证是否已登录
- 验证是否为超管（`is_superuser === true`）
- 非超管用户访问 → 重定向到 `/user`

### 用户路由 (`/user/*`)
- 验证是否已登录
- 验证是否为普通用户（`is_superuser === false`）
- 超管用户访问 → 重定向到 `/admin`

## 布局独立性

**两套布局完全独立，互不影响：**

| 特性 | 管理员布局 (`_admin-layout`) | 用户布局 (`_user-layout`) |
|------|------------------------------|--------------------------|
| 布局文件 | `routes/_admin-layout.tsx` | `routes/_user-layout.tsx` |
| 导航方式 | 左侧 Sidebar | 顶部导航栏 |
| 样式修改 | 只影响管理员页面 | 只影响用户页面 |
| 共用组件 | 通用 UI 组件（Button、Form 等） | 通用 UI 组件（Button、Form 等） |

## 待迁移页面

以下页面已在旧 `_layout` 中存在，需要迁移到新的 `_admin-layout` 目录：

- [ ] `analysis.tsx` - 心理状况分析
- [ ] `psychological-test.tsx` - 在线心理测试
- [ ] `audio-recording.tsx` - 在线音频录制
- [ ] `video-recording.tsx` - 在线视频录制
- [ ] `history.tsx` - 历史分析记录
- [ ] `counselor-chat.tsx` - 心理医生咨询
- [ ] `user-manage.tsx` - 用户管理（需新建）

## 登录后重定向逻辑

```typescript
// useAuth.ts - loginMutation.onSuccess
登录成功 → 获取用户信息 → 判断 is_superuser
  ├─ true → navigate({ to: "/admin" })
  └─ false → navigate({ to: "/user" })
```