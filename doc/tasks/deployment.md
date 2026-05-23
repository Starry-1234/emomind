# 部署配置任务文档

## 任务概述
- **功能描述**: Docker 容器化配置、Docker Compose 编排、环境变量配置
- **涉及模块**: Dockerfile, compose.yml, compose.override.yml, .env
- **依赖任务**: 所有业务模块完成后执行

## 需求要点
- Spring Boot 后端 Docker 化（多阶段构建）
- 前端 Nginx Docker 化
- Docker Compose 编排所有服务
- 开发环境与生产环境隔离
- 双环境并行（端口隔离）

## 设计要点
- **关键文件**: backend-sb/Dockerfile, compose.yml, compose.override.yml
- **数据流**: Dockerfile 构建 → Docker Compose 编排 → 服务启动
- **边界条件**: 端口不冲突、环境变量正确注入、健康检查配置

## 实现步骤
1. [ ] 编写 backend-sb/Dockerfile（多阶段构建）
2. [ ] 编写 compose.yml（生产配置）
3. [ ] 编写 compose.override.yml（开发配置 + 端口隔离）
   - PostgreSQL: 5433
   - Backend: 8080
   - Frontend: 5174
   - Traefik Dashboard: 8091
   - Adminer: 8082
   - Mailcatcher Web: 10801
   - Mailcatcher SMTP: 1026
4. [ ] 配置 .env 文件
5. [ ] 配置 Docker 健康检查
6. [ ] 验证本地构建和启动

## 验收标准
- [ ] Docker 镜像构建成功
- [ ] Docker Compose 可正常启动所有服务
- [ ] 服务间通信正常
- [ ] 端口映射正确
- [ ] 环境变量正确注入
- [ ] 健康检查正常
- [ ] 生产配置和开发配置分离

## 相关文档
- 需求文档：doc/requirements.md #4.3
- 详细设计：doc/detailed-design.md #7.1, #7.2, #7.3