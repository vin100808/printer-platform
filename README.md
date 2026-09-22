# 打印机租赁运营平台 Web V1

当前完成阶段：**TASK 18｜兼容验证与收尾（业务模型简化重构全部完成）**。

本仓库是一个基于 Next.js、TypeScript、PostgreSQL 和 Prisma 的单体 Web 应用。功能覆盖：管理员登录；以 Order 为核心的业务流（客户 + 供应商 + 安装地址 + 多套餐明细 + 起止日期 + 押金 + 双附件，按月 / 按自然季度结算）；客户、供应商、机型库与套餐（含版本历史）管理；Printer 台账（部署统计、换机撤机生命周期、printerCode 自动生成、二维码）；MeterReading 免登录扫码抄表（照片、管理员调整）；基于抄表的运营结算（按天折算、自然季度聚合、Order 级应收 / 应付 / 毛利汇总，供应商侧价格缺失降级不阻塞客户侧）；工作台运营总览与抄表管理；数据完整性规则与 V1 验收场景的自动化集成测试（106 个测试）。

主导航 6 项：工作台、客户、订单、供应商、套餐、机型库。历史模块（供应商订单、供应商套餐、双侧框架合同）保留只读存档；Location 不再由用户维护，安装地址直接在订单上维护。

## 技术栈

- Node.js 22 LTS
- Next.js 16 / React 19 / TypeScript
- PostgreSQL 17（通过 Docker Compose / OrbStack 运行）
- MinIO（本地 S3 兼容对象存储，用于合同 / 订单附件与抄表照片）
- Prisma ORM
- Tailwind CSS
- Vitest

## 首次启动

前置条件：Mac 上已安装并启动 OrbStack（或其他兼容 Docker Compose 的 Docker 环境），并安装 Node.js 22。

```bash
# 1. 使用项目要求的 Node.js 版本（如使用 nvm）
nvm use

# 2. 安装依赖
npm install

# 3. 创建本地环境变量
cp .env.example .env

# 4. 启动 PostgreSQL 与对象存储
docker compose up -d postgres minio

# 5. 执行数据库 Migration
npm run db:migrate:deploy

# 6. 创建或更新初始管理员
npm run db:seed

# 7. 启动开发服务器
npm run dev
```

浏览器访问：<http://localhost:3000>

管理员邮箱和密码由本地 `.env` 中的 `ADMIN_EMAIL` 与 `ADMIN_PASSWORD` 决定。配置后运行 `npm run db:seed` 创建或更新管理员。`.env` 已被 Git 忽略，不会提交。

## 日常启动与停止

```bash
# 启动数据库与对象存储
docker compose up -d postgres minio

# 启动 Web
npm run dev

# 停止数据库容器（数据仍保留）
docker compose down
```

数据库数据保存在 `printer-platform-postgres-data`，附件保存在 `printer-platform-minio-data`。执行普通的 `docker compose down` 或重建容器不会丢失数据。只有明确执行 `docker compose down -v` 或手动删除对应 Volume 才会删除数据。

## 常用命令

```bash
npm run lint               # ESLint
npm run typecheck          # TypeScript 类型检查
npm test                   # 单元测试
npm run build              # 生产构建
npm run db:migrate         # 开发环境创建/应用 Migration
npm run db:migrate:deploy  # 应用已有 Migration（部署环境）
npm run db:seed            # 创建/更新初始管理员
npm run db:studio          # 打开 Prisma Studio
```

健康检查地址：<http://localhost:3000/api/health>。数据库正常时返回：

```json
{"status":"ok","database":"connected"}
```

## 数据库连接

本地 Host 为 `localhost`，端口为 `5432`。数据库名、用户和密码由 `.env` 中的 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD` 决定，并应与 `DATABASE_URL` 保持一致。

## 部署说明

仓库已提供生产用多阶段 `Dockerfile`，Next.js 使用 standalone 输出，便于后续部署至 Linux。生产环境应通过部署平台注入真实的 `DATABASE_URL` 等环境变量，并在发布时先运行：

```bash
npm run db:migrate:deploy
```

本地 MinIO API 地址为 <http://localhost:9000>，管理控制台为 <http://localhost:9001>。应用通过标准 S3 接口访问对象存储，后续部署可改用云 S3 服务。

## 目录结构

```text
src/
  actions/        服务端操作（Server Actions：登录、主数据、订单、打印机、抄表等）
  app/            Next.js App Router 页面与 API
  components/     可复用界面组件
  lib/            数据库、认证、结算、校验等业务与基础设施
prisma/
  migrations/     数据库 Migration 历史
  schema.prisma   Prisma 数据模型与基础枚举
  seed.ts         初始管理员种子
docs/             项目需求、重构评估报告与开发进度
```
