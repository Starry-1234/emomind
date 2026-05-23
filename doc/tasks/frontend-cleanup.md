# 前端清理任务文档

## 任务概述
- **功能描述**: 清理前端未使用的组件、hooks 和服务
- **涉及模块**: frontend/src/components, frontend/src/hooks
- **依赖任务**: 无（独立任务）

## 需求要点
- 删除未使用的组件（AdminSidebar 等）
- 删除未使用的 hooks（useCopyToClipboard 等）
- 删除未使用的 UI 组件（button-group, pagination 等）
- 更新前端自动生成客户端（去掉 Item/Private/Utils 相关代码）

## 设计要点
- **关键文件**: AdminSidebar.tsx, useCopyToClipboard.ts, button-group.tsx, pagination.tsx
- **数据流**: 代码清理 → 构建验证
- **边界条件**: 确保删除的代码确实未被引用

## 实现步骤
1. [ ] 分析并删除未使用的组件
   - [ ] AdminSidebar.tsx
   - [ ] button-group.tsx
   - [ ] pagination.tsx
2. [ ] 分析并删除未使用的 hooks
   - [ ] useCopyToClipboard.ts
3. [ ] 更新前端自动生成客户端
   - [ ] 重新生成 sdk.gen.ts（不包含 Item/Private/Utils）
4. [ ] 验证前端构建正常
5. [ ] 验证前端功能正常

## 验收标准
- [ ] 未使用的组件已删除
- [ ] 未使用的 hooks 已删除
- [ ] 前端构建无错误
- [ ] 前端功能测试通过
- [ ] 自动生成的客户端不包含废弃 API

## 相关文档
- 需求文档：doc/requirements.md #3
- 详细设计：doc/detailed-design.md #8