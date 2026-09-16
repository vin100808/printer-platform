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

## TASK 02｜客户、供应商、地点、合同

状态：已完成

完成内容：

- Customer、Supplier、Location 数据模型与 CRUD 页面。
- CustomerFrameworkContract 多对多关联 Customer。
- SupplierFrameworkContract 归属 Supplier。
- 客户与供应商详情页展示公司、银行、联系人、地点和合同资料。
- 合同附件使用 S3 兼容对象存储，本地由持久化 MinIO 提供。
- 附件支持上传、替换、打开，并在合同删除时同步清理。
- 增加服务端认证、输入校验、唯一性约束和日期有效性校验。

范围说明：

- 未创建 MachineModel、CustomerPackage 或 SupplierPackage。
- 未实现 TASK 03 及之后的业务功能。

## 补充｜客户与供应商编码自动生成（TASK 03 前置）

状态：已完成

完成内容：

- 新增客户时 customerCode 由服务端自动生成，从 C0001 起按序递增（4 位数字，不足补零）。
- 新增供应商时 supplierCode 由服务端自动生成，从 S0001 起按序递增（4 位数字，不足补零）。
- 编码创建后不可修改；新增表单不再提供编码输入框，编辑页只读展示编码。
- 编码取已有最大数字序号 + 1，已删除记录使用过的编码不复用；并发新增冲突时自动重新取号重试，唯一索引兜底。
- 编码规则已同步至开发任务说明 TASK 02 的 Customer / Supplier 章节。

## TASK 03｜MachineModel 与 Package

状态：已完成

完成内容：

- MachineModel 数据模型与列表、新增、编辑、启停页面；黑白 / 彩色类型使用 TASK 01 预留的 DeviceType 枚举。
- CustomerPackage（customerId 为空即标准套餐）与 SupplierPackage（必须归属供应商）数据模型与页面。
- 套餐与 MachineModel 多对多关联，表单支持多选配置适配机型。
- 金额与额度字段全部使用 Decimal（月租 DECIMAL(10,2)、免费额度 DECIMAL(12,2)、超印单价 DECIMAL(10,4)）。
- 版本历史：`(packageCode, version)` 唯一约束；价格创建后不可修改，重新议价通过「新建版本」复制生成新版本，历史版本保留；详情页提供版本历史视图。
- 客户 / 供应商存在套餐时禁止删除（Restrict 外键 + 列表页错误提示）。
- 增加 catalog 校验（价格必填、非负、小数位限制、生效日期必填）与单元测试。

范围说明：

- 未创建 CustomerOrder、SupplierOrder、Printer 或 MeterReading。
- 未实现 TASK 04 及之后的业务功能；套餐尚未被订单引用，删除套餐暂不校验引用。

下一阶段：等待人工验收后执行 TASK 04。
