# 数据库设计任务文档

## 任务概述
- **功能描述**: PostgreSQL 数据库表结构设计、JPA 实体类、Flyway 迁移脚本
- **涉及模块**: entity, resources/db/migration
- **依赖任务**: 无（基础任务）

## 需求要点
- 用户表：存储用户认证信息和个人资料
- 文件分析报告表：存储用户上传文件的分析结果
- 测评记录表：存储心理测评的题目、答案、得分（JSON 列）
- 所有子表级联删除

## 设计要点
- **关键类**: User, FileAnalysisReport, TestRecord
- **数据流**: JPA Entity → Hibernate → PostgreSQL
- **边界条件**: UUID 主键、JSONB 列映射、级联删除、索引设计

## 实现步骤
1. [ ] 编写 User entity（JPA 注解映射）
2. [ ] 编写 FileAnalysisReport entity（JPA 注解映射）
3. [ ] 编写 TestRecord entity（含 JSON 列映射）
4. [ ] 编写 Flyway V1 迁移脚本（创建表 + 索引）
5. [ ] 编写 Flyway V2 迁移脚本（标记版本）
6. [ ] 配置 application.yml 中 Flyway 和 JPA
7. [ ] 验证数据库连接和自动迁移

## 验收标准
- [ ] 所有表结构正确创建
- [ ] JPA 实体与数据库表映射一致
- [ ] 外键和级联删除配置正确
- [ ] 索引创建成功
- [ ] Flyway 迁移可重复执行
- [ ] JSON 列可正常读写

## 相关文档
- 需求文档：doc/requirements.md #5.1, #5.2
- 详细设计：doc/detailed-design.md #2
