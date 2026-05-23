# 心理测评记录模块任务文档

## 任务概述
- **功能描述**: 心理测评记录的创建、查询、更新、删除，管理员可管理所有记录
- **涉及模块**: controller, service, repository, entity, dto
- **依赖任务**: auth, database, user-management

## 需求要点
- 用户可创建测评记录（测评名称、用户主题、题目JSON、答案JSON、得分、评分区间JSON）
- 用户可查看自己的测评记录列表（分页）
- 用户可查看单个测评记录详情
- 用户可更新自己的测评记录
- 用户可删除自己的测评记录
- 管理员可查看所有测评记录（可过滤用户）
- 管理员可删除任意测评记录

## 设计要点
- **关键类**: TestRecordController, TestRecordService, TestRecordRepository, TestRecord entity
- **数据流**: Client → TestRecordController → TestRecordService → TestRecordRepository → PostgreSQL
- **边界条件**: JSON 列验证、分页参数、资源归属校验、管理员权限校验

## 实现步骤
1. [ ] 编写 TestRecord entity（含 JSON 列映射）
2. [ ] 编写 TestRecordRepository
3. [ ] 编写 TestRecordService
4. [ ] 编写 TestRecordController
5. [ ] 实现 GET /test-records/（列表查询）
6. [ ] 实现 POST /test-records/（创建记录）
7. [ ] 实现 GET /test-records/{id}（详情查询）
8. [ ] 实现 PUT /test-records/{id}（更新记录）
9. [ ] 实现 DELETE /test-records/{id}（删除记录）
10. [ ] 实现 GET /admin/test-records（管理员查询所有）
11. [ ] 实现 DELETE /admin/test-records/{id}（管理员删除）
12. [ ] 编写 DTO（request/response）
13. [ ] 编写 MapStruct 映射
14. [ ] 单元测试

## 验收标准
- [ ] 用户可创建测评记录
- [ ] JSON 列（题目、答案、评分区间）正常存储和读取
- [ ] 用户可查看自己的记录列表（分页）
- [ ] 用户可查看单个记录详情
- [ ] 用户可更新自己的记录
- [ ] 用户可删除自己的记录
- [ ] 管理员可查看所有记录（可过滤用户）
- [ ] 管理员可删除任意记录
- [ ] 普通用户无法访问管理员接口

## 相关文档
- 需求文档：doc/requirements.md #3.4
- 详细设计：doc/detailed-design.md #3.4, #4.1, #4.4, #4.5
