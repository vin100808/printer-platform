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

## TASK 04｜客户订单与供应商订单

状态：已完成

完成内容：

- CustomerOrder / CustomerOrderItem / SupplierOrder / SupplierOrderItem 数据模型与页面。
- 订单编号由服务端自动生成：当天日期 + 当日序号（YYYYMMDD + 01 起），客户订单与供应商订单共用同一序列、单号全局唯一，并发冲突自动重试。
- 客户订单强制：Location 属于所选 Customer、客户框架合同关联该客户、明细套餐为该客户可用（标准或专属）；服务端逐一校验。
- 供应商订单强制：合同与套餐必须属于所选供应商。
- 订单明细（套餐 + 数量 + 计划进场日期）创建后可在编辑页修改（保存时整体替换，服务端重新校验套餐适用性）；计划进场日期必填；新增机器必须新建订单，禁止通过改历史数量表示新增。
- 订单状态使用 OrderStatus 枚举（草稿 / 已确认 / 已完成 / 已取消）；订单附件走 S3 对象存储，支持上传、替换、打开，删除订单时清理。
- 明细展示部署进度 `已部署 n / 数量` 与部署状态（未部署 / 部分部署 / 已部署），动态计算不存库；TASK 05 起由 Printer 台账自动统计。
- 客户 / 供应商 / Location / 合同 / 套餐对订单均为 Restrict 外键，历史单据不被级联破坏。
- 增加 orders 校验（表头字段、明细行解析、数量整数 ≥1）与单元测试。

范围说明：

- 未创建 MeterReading；抄表属于 TASK 07。
- 未实现 TASK 05 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 05。

## TASK 05｜Printer 核心台账

状态：已完成

完成内容：

- Printer 数据模型与 migration：printerCode（唯一，编码规则暂不写死）、supplierAssetCode、machineModelId、customerOrderItemId、supplierOrderItemId、entryDate、exitDate、initialBwReading / initialColorReading、status（PrinterStatus：草稿 / 运行中 / 已换机 / 已撤机）、previousPrinterId（换机链，TASK 06 使用）、qrToken（创建时自动生成 URL 安全随机串）、remark。
- 不建 serialNumber；客户、地点、客户合同、供应商、供应商合同、双侧套餐全部通过订单明细自动追溯，创建打印机时只需选择客户订单明细、供应商订单明细、机型。
- 列表、新增、详情、编辑页面；详情页一屏展示客户侧（客户 / 地点 / 客户框架合同 / 客户订单及附件 / 客户套餐）、供应商侧（供应商 / 供应商框架合同 / 供应商订单及附件 / 供应商套餐）、设备信息、二维码 Token 与抄表历史入口（MeterReading 属 TASK 07）。
- 部署容量控制：明细的已部署台数（运行中打印机）达到订单数量后不可再部署；已取消订单不可部署；创建后状态为「运行中」。
- 订单明细部署进度真实统计：订单详情页 `已部署 n / 数量` 与部署状态按运行中 Printer 动态计算，并提供「部署打印机」直达入口。
- 数量守卫：编辑订单明细时，按套餐汇总的新数量不得低于该套餐已部署台数，防止历史部署悬空。
- 删除守卫：已有打印机台账记录的订单不可删除（Printer 对订单明细为 Restrict 外键，双保险）；已换机 / 已撤机的打印机保留历史不删除。
- 增加 printers 校验（编码必填、读数非负整数、明细必选）与单元测试。

范围说明：

- 换机、撤机等生命周期操作属于 TASK 06；MeterReading 与二维码抄表页面属于 TASK 07。
- 未实现 TASK 06 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 06。

## TASK 06｜新增、换机、撤机

状态：已完成

完成内容：

- 新增机器流程闭环：新 CustomerOrder / SupplierOrder → 明细 → Printer（TASK 05 已支持从订单明细部署，状态直接「运行中」）。
- 换机：仅运行中的打印机可换机；填写换机日期（原机退场日期 = 新机进场日期）、新机型、新打印机编码、新供应商资产编码、新初始读数；客户订单明细沿用原机，供应商明细默认沿用、供应商变化时可改选其他明细（需有剩余容量且订单未取消）；换机日期不得早于原机进场日期；旧机变「已换机」、新机「运行中」并记录 previousPrinterId，同一事务完成。
- 撤机：仅运行中的打印机可撤机；填写撤机日期（不得早于进场日期），状态变「已撤机」，记录保留不删除。
- 历史保护：已换机 / 已撤机的打印机不可删除（TASK 05 已有）、不可编辑（新增守卫）；换机链双向可查（上一台 / 后续替换机器互相链接）。
- 详情页按状态显示操作：运行中才有「换机 / 撤机」入口。
- 增加换机 / 撤机 schema 校验与生命周期守卫单元测试。

范围说明：

- MeterReading 唯一性、抄表限制与二维码页面属于 TASK 07；结算属于 TASK 08。
- 未实现 TASK 07 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 07。
