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

## TASK 07｜二维码抄表

状态：已完成

完成内容：

- MeterReading 数据模型与 migration：printerId、readingYear / readingMonth（业务月份）、前后黑白 / 彩色读数、bwUsage / colorUsage / bwEquivalentUsage（计算快照）、photoUrl、submittedAt、status（submitted / adjusted）、adminNote、updatedBy。
- 唯一约束 `UNIQUE(printerId, readingYear, readingMonth)`：一台打印机一个业务月份只能存在一条正式抄表，数据库层兜底。
- 公开抄表页 `/meter/{qrToken}`：无需登录；展示客户、地点、机型等设备信息；每月 1-3 日开放提交上一自然月（4-25 日显示「本期已关闭」，26 日起显示「本期尚未开放」）。
- 设备类型适配：彩色机显示黑白 + 彩色读数，黑白机只显示黑白；黑白机服务端拒绝彩色读数（防篡改）。
- 提交规则：仅运行中打印机可提交（已换机 / 已撤机提示停止使用）；必须上传抄表照片（JPG / PNG，最大 10MB，S3 对象存储）；当前读数不得低于上期读数（上期 = 最近抄表或进场初始读数）；本期已提交则显示「已提交，如需修改请联系管理员」，不可二次提交。
- 固定换算规则落地：1 张黑白 = 1 BW Equivalent，1 张彩色 = 10 BW Equivalent，服务端计算并快照。
- 后台管理：打印机详情页展示抄表历史（含照片、状态、调整备注）与公开抄表入口链接；管理员可在 `/meter-readings/[id]/edit` 调整读数（必填调整说明，状态变「已调整」，记录操作人，重新计算用量）。
- 增加 meter 单元测试（开放窗口三种状态、跨年期份、用量计算、schema 校验）。

范围说明：

- 「本期应抄 / 已抄 / 未抄」汇总视图属于 TASK 09；结算金额属于 TASK 08。
- 抄表窗口按服务器本地时间判定。
- 未实现 TASK 08 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 08。

## TASK 08｜运营结算

状态：已完成

完成内容：

- 结算计算引擎 `src/lib/settlement.ts`（decimal.js 精确十进制，全程不使用浮点数）：BW Equivalent = 黑白用量 + 彩色用量 × 10；activeDays 按进场 / 退场日期计算指定自然月在场天数（进场日计入、退场日不计入）；月租与免费额度按天折算；超印量 = MAX(等价用量 − 折算额度, 0)；超印费 = 超印量 × 超印单价；当月金额 = 折算月租 + 超印费。
- 客户侧使用 CustomerPackage 计算客户应收，供应商侧使用 SupplierPackage 计算供应商应付，毛利 = 客户应收 − 供应商应付；金额统一保留两位小数（HALF_UP）。
- 打印机详情页新增「月度结算」区块：展示最近一个抄表月份的黑白 / 彩色用量、BW Equivalent、双侧折算月租 / 免费额度 / 超印量 / 超印费 / 当月金额，以及客户应收、供应商应付、运营毛利。
- 按天折算边界：当月不在场（0 天）不产出结算金额；跨月进场 / 退场按实际天数折算。
- 增加 settlement 单元测试，覆盖文档验收示例（450 × 11 / 30 = 165、免费额度 10000 × 11 / 30、超印与毛利）及非整除四舍五入、零在场天数等边界。

范围说明：

- 结算为实时计算展示，不生成结算单表、不做账单导出；正式财务能力（开票 / 回款）不在 V1 范围。
- 结算月份取该打印机最近一条抄表记录的业务月份。
- 未实现 TASK 09 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 09。

## TASK 09｜后台首页与常用视图

状态：已完成

完成内容：

- 工作台总览：本期业务月份（与抄表窗口同一周期）、使用中机器数、本期应抄 / 已抄 / 未抄数量、当前客户数、当前供应商数，统计卡片可点击直达对应管理页。
- 抄表管理页 `/meter-readings`：本期应抄 / 已抄 / 未抄统计卡；本期未抄清单（客户 / 地点 / 机型 / 进场日期 + 抄表页直达链接，便于催收）；本期已抄清单（用量、状态、提交时间、调整入口）；历史记录（最近 100 条）。
- 打印机台账筛选：按客户、地点（标注所属客户）、供应商、机型、状态组合筛选，可一键重置。
- 客户详情增强：客户订单列表、使用中打印机、历史打印机（换机 / 撤机状态与进退场日期）。
- 供应商详情增强：供应商订单列表、使用中打印机、历史打印机。
- 新增 `currentPeriod` 共享函数（本期业务月份与抄表窗口一致）与单元测试。

范围说明：

- 「本期」定义：每月 1-3 日与 4-25 日为本周期上一自然月（开放 / 催收期），26 日起为当月（即将开放）。
- 未实现 TASK 10 及之后的业务功能。

下一阶段：等待人工验收后执行 TASK 10（数据完整性与基础测试）。

## TASK 10｜数据完整性与基础测试

状态：已完成

完成内容：

- 新增 `src/lib/integrity.test.ts` 集成测试（数据库未运行时自动跳过，不影响本地开发）：
- 数据完整性规则（数据库层兜底）：MeterReading 同机同年同月唯一（P2002）、历史使用中的双侧套餐禁止硬删除（Restrict）、有打印机的双侧订单禁止删除、被打印机引用的机型禁止删除、抄表随打印机级联删除、当前读数不得低于上期读数。
- 最终 V1 验收场景（端到端数据链路）：Scenario 1 新客户全流程（订单明细 ×2 → 两台 Printer active）；Scenario 2 扫码抄表后后台可见且结算自动算出客户应收 385 / 供应商应付 300.67 / 毛利 84.33（文档验收示例精确值）；Scenario 3 坏机换机（旧机 replaced + 历史抄表保留，新机 previousPrinterId 链接且从初始读数开始）；Scenario 4 新增机器必须走新订单（原订单明细数量不被修改）；Scenario 5 撤机后状态 removed 且历史数据完整可查。
- 应用层规则此前各 TASK 已全部落地（Location 归属校验、套餐适用性校验、仅 active 打印机可抄表、黑白机拒彩色读数、历史打印机禁删禁改），本 TASK 以自动化测试固化并验证。

范围说明：

- V1 十个 TASK 全部完成；后续可进入整体人工验收与部署准备。

下一阶段：等待人工验收 V1 整体。

## TASK 11｜业务模型简化重构评估

状态：已完成（评估报告经人工确认，含 8 条修正）

完成内容：

- 输出《TASK 11｜业务模型简化重构评估报告》（`docs/TASK11-业务模型简化重构评估报告.md`）：当前真实系统结构、新旧模型映射、Gap Analysis、风险评估、数据迁移方案、UI 重构方案、TASK 12 onward 拆分。
- 核心结论：不新增 Deal Model，直接演进现有 `CustomerOrder` 为新的核心 Order；旧表（Location / FrameworkContract / SupplierOrder / SupplierOrderItem / SupplierPackage）全部保留兼容、不 DROP；MeterReading 成熟逻辑零重写。
- 人工确认的修正要点：Order 保留两个独立文件槽（合同文件 + 订单附件）；历史 supplierId 按 0/1/多供应商规则回填；installationAddress 只取 Location 真实地址字段；printerCode 不做全库全局唯一（内部唯一靠 id / qrToken）；Printer 进场不得依赖 SupplierOrder；供应商侧价格缺失不得阻塞客户业务；Order status 不做高风险 enum 改名；管理员保留最终修改权（风险提示而非 hard block）。

下一阶段：TASK 12（Schema 演进与兼容迁移）。

## TASK 12｜Schema 演进与兼容迁移

状态：已完成

Schema 实际修改：

- 新增 `enum BillingCycle { monthly, quarterly }`（quarterly 为自然季度，TASK 16 在月度计算上聚合）。
- `CustomerOrder` 演进为新核心 Order：
  - 新增 `supplierId String?`（FK → Supplier，ON DELETE RESTRICT，含反向关系与索引）；
  - `locationId` / `customerContractId` 由必填改为可空（新业务不再以 Location / 框架合同为前置条件）；
  - 新增 `installationAddress String?`、`startDate DateTime? @db.Date`、`endDate DateTime? @db.Date`、`billingCycle BillingCycle @default(monthly)`、`depositAmount Decimal? @(10,2)`、`depositReceivedDate DateTime? @db.Date`、`contractAttachmentUrl String?`（第二个文件槽 orderAttachmentUrl 沿用既有字段）。
- `Printer.supplierOrderItemId` 由必填改为可空；移除 `printerCode` 全库唯一约束，降为普通索引（不同供应商允许同编号，内部唯一靠 id / qrToken）。
- 未做的事（有意）：OrderStatus enum 不改名（保留 `confirmed`，UI 层映射为「履约中」）；不 DROP 任何旧表。

Migration：`20260919180505_task12_order_evolution`

- DDL：BillingCycle enum、三列 DROP NOT NULL、Order 新列、printers 索引替换、supplier FK。
- 数据回填（全部在 migration.sql 内，可重放）：
  1. installationAddress ← Location.address（地址缺失保持 NULL，不编造）；
  2. startDate ← order_date（无更可靠历史来源）；
  3. endDate ← startDate + 3 年 − 1 天（默认规则）；
  4. depositAmount ← Σ 明细 quantity × 2000（depositReceivedDate 保持 NULL，历史收款状态未知）；
  5. supplierId ← 仅当历史订单反推出恰好 1 个 distinct 供应商时回填；0 个或多个保持 NULL，历史事实继续由旧 SupplierOrderItem 关系承载。

代码兼容修复（Schema 可空化的空值防御，不改业务逻辑）：

- 约 13 个页面/测试文件：`order.location`、`order.customerContract`、`printer.supplierOrderItem` 全部改为 null-safe 显示（「—」/「未关联供应商订单」）。
- `src/lib/settlement.ts` 新增 `computeSettlementOptionalSupplier`：供应商套餐缺失时客户侧照常计算，supplier 与毛利返回 null（页面显示「未配置」/「暂不可计算」），落实「供应商侧缺失不得阻塞客户业务」。
- `src/lib/orders.ts` 新增纯函数 `DEPOSIT_PER_PRINTER = 2000`、`computeDepositAmount(totalQuantity)`、`defaultEndDate(startDate)`（startDate + 3 年 − 1 天，按 UTC 日历日对齐 @db.Date），供 TASK 13+ 表单与回填复用。

历史真实数据迁移结果（迁移前后数量逐项核对一致）：

- Customer 1 / Supplier 1 / Location 1 / 客户框架合同 1 / 客户订单 1（明细 1）/ 供应商订单 1（明细 1）/ Printer 1 / 抄表 0 / 套餐各 1。
- 试点订单 `2026091702`：supplierId 已回填（恰 1 个供应商）；installationAddress 回填为 Location.address（试点值 `342432`）；startDate 2026-09-02（= order_date），endDate 2029-09-01（默认规则）；depositAmount 64000（= 32 × 2000）；depositReceivedDate 保持 NULL。
- supplierId 回填 1 条 / NULL 0 条（仅试点订单，无多供应商历史订单）。

验证结果：

- 迁移后脚本验证：数量与快照一致；supplierId=NULL 订单详情页 200；supplierOrderItemId=NULL 打印机详情页 200 且显示「未配置」；试点打印机页正常；临时数据已清理。
- 80 个单元测试全绿（新增 5 个：押金计算 ×1、endDate 默认 ×1、OptionalSupplier 结算 ×3）。
- prisma validate / format --check / migrate status（up to date）/ typecheck / lint / build 全部通过。

风险与遗留：

- 旧代码仍依赖旧模型（TASK 13+ 逐步切换，当前均可正常运行）：Location（订单创建仍必选 Location）、CustomerFrameworkContract（订单创建必选合同）、SupplierOrder / SupplierOrderItem（打印机创建/换机仍要求供应商订单明细）、SupplierPackage（供应商侧结算）。
- 订单创建/编辑表单尚未使用新字段（supplierId、billingCycle、押金、双附件、endDate 默认值），属 TASK 13/14 范围。
- printerCode 去掉全局唯一后，重复码的应用层提示与按订单上下文识别在 TASK 15 处理。

下一阶段：TASK 13（Order 核心业务流与 UI），等待人工确认后开始。
