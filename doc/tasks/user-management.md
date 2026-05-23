# 用户管理模块任务文档

## 任务概述
- **功能描述**: 用户个人信息管理、管理员用户管理
- **涉及模块**: controller, service, repository, entity, dto
- **依赖任务**: auth, database

## 需求要点
- 用户可查看和修改自己的信息（邮箱、全名）
- 用户可删除自己的账户（级联删除关联数据）
- 管理员可查看所有用户列表、创建、修改、删除任意用户
- 邮箱修改时不能与其他用户重复

## 设计要点
- **关键类**: UserController, UserService, UserRepository, User entity
- **数据流**: Client → UserController → UserService → UserRepository → PostgreSQL
- **边界条件**: 邮箱唯一性校验、级联删除确认、超级用户权限校验

## 实现步骤
1. [ ] 编写 User entity（JPA 映射）
2. [ ] 编写 UserRepository（基础 CRUD + 邮箱查询）
3. [ ] 编写 UserService（业务逻辑）
4. [ ] 编写 UserController（REST API）
5. [ ] 实现 GET /users/me 获取当前用户
6. [ ] 实现 PATCH /users/me 更新当前用户
7. [ ] 实现 DELETE /users/me 删除当前用户
8. [ ] 实现 GET /users/ 管理员获取所有用户
9. [ ] 实现 POST /users/ 管理员创建用户
10. [ ] 实现 GET /users/{id} 管理员获取指定用户
11. [ ] 实现 PATCH /users/{id} 管理员更新指定用户
12. [ ] 实现 DELETE /users/{id} 管理员删除指定用户
13. [ ] 单元测试（Service, Controller）

## 验收标准
- [ ] 用户可查看自己的完整信息
- [ ] 用户可修改邮箱和全名
- [ ] 邮箱修改时重复校验正常
- [ ] 用户删除账户时关联数据一并删除
- [ ] 管理员可查看所有用户分页列表
- [ ] 管理员可创建/更新/删除任意用户
- [ ] 非管理员访问管理员接口返回 403

## 相关文档
- 需求文档：doc/requirements.md #3.2
- 详细设计：doc/detailed-design.md #3.2, #4.1, #4.4, #4.5
