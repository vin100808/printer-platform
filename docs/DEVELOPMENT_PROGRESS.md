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

## TASK 13｜Order 核心业务流与 UI

状态：已完成，等待人工体验页面

完成内容：

- 路由 `/customer-orders` 全面改名 `/orders`（导航显示「订单」），全部内部链接、Server Action 重定向与 revalidate 已同步；旧路由 404（TASK 17 统一处理兼容跳转）。
- 新订单表单重构为新核心 Order 心智：客户 + 供应商 + 安装地址（文本，替代 Location 选择）+ 开始日期（必填）/ 结束日期（选开始日期自动填 +3 年 − 1 天，可手改，服务端兜底 defaultEndDate）+ 结算方式（按月 / 按自然季度）；不再要求 Location 与客户框架合同；下单日期服务端自动记为当天；押金应收保存时自动计算（Σ明细数量 × 2000）。
- 订单编辑放开管理员修改权：供应商、安装地址、起止日期、结算方式、下单日期、状态、备注均可改；客户不可改。
- 明细按行 diff 更新（替代整体替换），历史保护硬规则：已有打印机记录的明细行不能更换套餐、不能删除该行（清晰报错指引先撤机/换机）；调低数量不再硬阻止，改为前端 confirm 风险提示；新行照常添加。disabled 行的套餐选择器不随表单提交，已用隐藏 input 保证行值对齐（服务端校验兜底）。
- 状态语义映射：confirmed → 履约中、completed → 已结束（enum 值不变）。
- 列表页新增供应商、安装地址列；详情页展示供应商、安装地址、起止日期、结算方式、押金应收（含已收/未收）；客户详情页订单表同步新字段与链接。
- 测试：82 个用例全绿（更新新 schema 必填项用例，新增 endDate 早晚校验、itemId 逐行解析用例）。

验证结果：prisma validate、typecheck、lint、build 全过；真实页面烟测（管理会话）：/orders 列表、试点订单详情（押金 ¥64000 未收、2029/9/1 到期、供应商 rea）、新增订单表单、编辑表单均 200 且关键字段渲染正确。

边界说明：打印机进场仍走原流程（TASK 15）；双附件（合同文件槽）与押金收款日期编辑 UI 属 TASK 14；新增/编辑订单的 Server Action 端到端走单建议人工体验时覆盖。

## TASK 14｜订单详情聚合页 + 结束订单

状态：已完成，等待人工体验页面

完成内容：

- 订单详情页重构为一页聚合视图：基本信息（含合同文件、订单附件两个独立文件槽、押金应收及收款状态）、订单明细与部署进度（合计数量 / 已部署合计 + 逐行进度）、已进场打印机台账（全部状态，含最近抄表月份与 BW Equivalent 直达详情）、抄表摘要（最近业务月份、该月已抄 x / y 台、运行中台数）、结算摘要（按各打印机最近抄表月份实时计算，汇总到订单最近业务月份，展示客户应收 / 供应商应付 / 运营毛利，供应商侧缺失时单项显示「未配置 / 暂不可计算」且不阻塞客户侧）。
- 新增纯函数 `summarizeOrderSettlements`（`src/lib/settlement.ts`）：取最近业务月份、逐台金额求和、任一台缺供应商侧价格时应付与毛利置 null；5 个新测试用例覆盖跨月选取、汇总、缺失降级与四舍五入。
- 结束订单：新增 `completeCustomerOrder` Server Action 与 `CompleteOrderButton` 客户端组件（`src/components/order-actions.tsx`）。仅把订单状态改为 `completed`（已取消订单拒绝），不触碰 Printer / MeterReading / 附件 / 历史结算；仍有运行中打印机时前端弹明确风险提示（列出台数并说明历史数据不变），管理员确认后继续；已结束订单不再显示按钮，成功后显示「订单已结束」横幅。
- 补齐 TASK 13 遗留的表单接口接线：编辑页传入 `contractAttachmentUrl` 与 `depositReceivedDate`（合同文件槽重新上传即替换、删除订单时双槽文件均清理）；新增/编辑表单支持合同文件上传与押金收款日期。
- 订单状态徽标配色扩展：confirmed 履约中（绿）、completed 已结束（蓝）、draft 草稿（灰）、cancelled 已取消（红）。

验证结果：

- 87 个用例全绿（新增 5 个结算汇总用例）；prisma validate / typecheck / lint / build 全部通过。
- 生产构建 + 真实数据库烟测（管理会话）：`/orders/[id]` 聚合页 200 且各区块（明细 / 打印机 / 抄表摘要 / 结束订单按钮）渲染正确；编辑页 200 且合同文件、押金收款日期字段渲染正确；通过 Next-Action 协议真实调用 `completeCustomerOrder`：订单状态变「已结束」、重定向 `?completed=1`、打印机保持运行中（历史数据零改动）、完成后按钮消失且横幅展示；试点订单状态已复原为「履约中」。

范围说明：

- 结束订单不自动撤机（打印机生命周期属 TASK 15）；结算摘要仅为当前可得的实时汇总，正式结算单 / 账单属 TASK 16；旧 UI（供应商订单等）保留未动。
- 烟测时清除了数据库中的旧登录会话（不影响数据，重新登录即可）。

下一阶段：TASK 15（Printer 解耦重构），建议先人工体验本 TASK 页面。

## TASK 15｜Printer 解耦重构

状态：已完成，等待人工体验页面

完成内容：

- 解除新 Printer 创建对 SupplierOrder / SupplierOrderItem 的依赖：进场表单不再出现供应商订单明细选择器，只需客户订单明细 + 机型 + 进场日期 + 初始读数；`printerSchema.supplierOrderItemId` 改为可空，服务端仅在选择时校验其存在性 / 订单未取消 / 交付容量。旧入口兼容：供应商订单详情页「部署打印机」链接携带的 `supplierOrderItemId` 参数仍可通过隐藏字段关联。
- `supplierAssetCode` 列改为可空（migration `20260921061413_task15_printer_decouple`，仅 DROP NOT NULL，无破坏性 DDL）；新表单中改为选填，详情 / 列表 / 订单聚合页全部空值安全（显示「—」）；编辑页保留该字段用于修正历史数据。
- printerCode 生成规则落地（TASK 11 §11.3）：手填编码 > 供应商资产编码 > 系统生成（`nextCode` 扩展支持 P 前缀，P0001 起，不复用已删除记录的序号）；新增纯函数 `resolvePrinterCode` 与 3 个单测。
- 重复编码应用层提示（TASK 12 遗留）：手填 / 资产编码与「运行中」打印机重名时返回清晰错误（列出所属客户，提示更换或留空自动生成）；历史机重名不拦截（不同供应商允许同编号）；内部唯一仍靠 id / qrToken。
- 换机适配：供应商明细改为可选，留空 = 沿用原机（原机未关联则新机也不关联）；改选时照旧校验订单未取消与交付容量（排除旧机）；新打印机编码 / 资产编码同样支持留空自动生成；换机事务（旧机 replaced + exitDate、新机 active + previousPrinterId）与撤机逻辑不变，MeterReading 与历史 Printer 零改动。
- 编辑打印机：printerCode 仍必填（创建时已解析出最终编码），supplierAssetCode 改为选填。

测试与验证：

- 91 个用例全绿：printerSchema / printerReplaceSchema 可空化用例更新，新增 resolvePrinterCode ×3、nextCode P 前缀 ×1；integrity 新增 Scenario 6（无供应商订单 / 资产编码进场 → 抄表 → 供应商侧缺失结算降级 → 换机保持无关联 → 撤机），TASK 10 原 5 场景不受影响。
- prisma validate / typecheck / lint / build 全部通过。
- 真实页面烟测（管理会话 + MPA 表单协议真实调用 Server Action）：新增打印机编码 / 资产编码 / 供应商明细全留空 → 自动生成 P0001、供应商两侧字段 NULL、详情页 200 且显示「资产编码 —」与「未配置」；手填 P0001 重名 → 返回「已有运行中的打印机使用编码」提示；对 P0001 换机（全留空）→ 旧机 replaced + exitDate、新机自动生成 P0002、previousPrinterId 链接正确；试点历史打印机（test1 / 资产 wcea / 有关联供应商订单）详情、编辑、换机页均 200 且数据显示完整。烟测数据已清理，库中仅剩试点打印机。
- 注意：migration 重新生成 Prisma Client 后需重启 dev server，否则旧 Client 会拒绝可空字段（本次烟测已踩坑并确认）。

范围说明：

- 不做 TASK 16（Settlement 重构 / Order 级聚合增强）与 TASK 17（导航与旧 UI 收敛）；供应商订单 / 供应商套餐等旧页面保持现状。
- 订单详情页「部署打印机」入口、部署容量控制、部署进度统计逻辑不变（仍按运行中 Printer 统计客户订单明细）。

下一阶段：TASK 16（Settlement 适配），建议先人工体验本 TASK 页面。

## TASK 16｜Settlement 适配：Order 聚合 + 自然季度结算

状态：已完成，等待人工体验页面

完成内容：

- `src/lib/settlement.ts` 新增纯函数（月度计算逻辑零改动）：
  - `quarterOfMonth(month)`：自然季度 Q1（1-3 月）/ Q2（4-6）/ Q3（7-9）/ Q4（10-12）。
  - `aggregateQuarterlySettlement(results)`：单 Printer 自然季度聚合——取结果集中最近的季度，把该季度内各月 `computeSettlementOptionalSupplier` 结果逐字段求和（折算月租 / 免费额度 / 超印量 / 超印费 / 月金额、黑白 / 彩色 / BW Equivalent 用量）；免费额度仍按 Printer 逐月独立折算，不跨机共享；季度中途进场 / 退场由各月既有按天折算自然处理；任一月份缺供应商侧价格时 supplier 与毛利为 null、客户侧照常汇总；空结果返回 null。
  - `summarizeOrderQuarterlySettlements(results)`：Order 级季度汇总——先逐 Printer 聚合到季度，再取各打印机最近季度求和客户应收 / 供应商应付 / 毛利；任一打印机缺供应商侧价格时应付与毛利为 null，不阻塞客户侧。
- 订单详情页（`/orders/[id]`）按 `billingCycle` 切换结算摘要：monthly 保持既有行为（各打印机最近抄表月份 → `summarizeOrderSettlements`）；quarterly 逐台先算各月、经 `aggregateQuarterlySettlement` 聚合后经 `summarizeOrderQuarterlySettlements` 汇总，标题显示「结算摘要 · yyyy 年 Qn」，说明文案含结算方式与按天折算提示。抄表查询由 `take: 1` 调整为 `take: 3`（恰好覆盖一个自然季度，monthly 仍只用最近一条）。
- 打印机详情页：订单为 quarterly 时在月度结算区块上方新增「季度结算 · yyyy 年 Qn」区块（聚合月份数、BW Equivalent 合计、双侧折算月租 / 额度 / 超印 / 季度金额、应收 / 应付 / 毛利，供应商侧缺失显示「未配置 / 暂不可计算」）；月度结算区块保持原样不变。
- 未动：MeterReading / Package Version / 既有月度结算数据与逻辑；无 schema 变更、无 migration。

测试与验证：

- 102 个用例全绿（新增 11 个：quarterOfMonth 边界、整季聚合、季度中途进场按天折算、跨季度取最新、单月份缺供应商降级、季度中途退场、订单季度汇总 ×3 等）；prisma 无变更，typecheck / lint / build 全部通过。
- 生产构建 + 真实数据库烟测（临时管理会话）：monthly 试点订单与打印机页 200 且仍显示月度结算；新建 quarterly 临时订单 + 打印机 + Q3 两个月（8/20 进场）抄表 → 订单页显示「结算摘要 · 2026 年 Q3」客户应收 27692.06 / 供应商应付 447855.60 / 毛利 -420163.54（与手工逐月按天折算结果逐项一致），打印机页同时渲染季度区块（聚合 2 个月）与原月度区块；烟测数据与临时会话已清理。

范围说明：

- 结算仍为实时计算展示，不生成结算单表；工作台应收 / 应付 / 毛利合计不在本次范围（TASK 11 报告中的可选项，未列入本 TASK 要求）。
- 不做 TASK 17（导航与旧 UI 收敛）。

下一阶段：TASK 17，建议先人工体验本 TASK 页面。
