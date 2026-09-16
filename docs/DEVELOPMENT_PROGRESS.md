# 开发进度

## TASK 01｜初始化项目与数据库骨架

状态：已完成

完成内容：

- 初始化 Next.js、React、TypeScript 与 Tailwind CSS 单体 Web 项目。
- 接入 Prisma ORM 与 Docker Compose PostgreSQL 17。
- 使用命名 Volume `printer-platform-postgres-data` 持久化数据库。
- 建立 `CustomerType`、`RecordStatus`、`PrinterStatus`、`OrderStatus`、`DeviceType` 五个基础枚举。
- 建立最小管理员账号和数据库会话模型。
- 完成登录、退出、受保护后台工作台和数据库健康检查。
- 增加 Seed、Migration、lint、typecheck、test、build 命令。
- 增加适用于后续 Linux 部署的多阶段 Dockerfile。

范围说明：

- 未创建 Customer、Supplier、Location、Contract 等 TASK 02 业务模型。
- 未实现 TASK 02 及之后的任何业务页面或流程。
- 对象存储将在首次出现附件功能的后续任务中接入。

下一阶段：等待明确指令后执行 TASK 02。
