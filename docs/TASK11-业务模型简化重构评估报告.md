# TASK 11｜业务模型简化重构评估报告

> 状态：评估完成，未实施任何代码修改。本文档是 TASK 12+ 的实施依据。
> 基线：`b6365f1`（TASK 10 完成，V1 全部交付，75 测试全绿，8 个 migration）。

---

## 11.1 当前真实系统结构

### Prisma Models（16 个，5 个 enum）

| Model | 核心字段 | 关键关系 |
|---|---|---|
| AdminUser / AdminSession | email、密码哈希、会话哈希 | 登录认证 |
| Customer | customerCode(唯一,自动生成 C0001)、customerName、customerType、税号、注册地址、银行×3、联系人、status | → locations / frameworkContracts(m-n) / customerPackages / customerOrders |
| Location | customerId(NOT NULL)、locationCode、locationName、address、联系人、status | 属于 Customer；被 CustomerOrder 引用 |
| CustomerFrameworkContract | contractNo、contractName、effectiveDate、expiryDate、status、attachmentUrl | m-n Customer；被 CustomerOrder 引用 |
| SupplierFrameworkContract | 同上 + supplierId | 属于 Supplier；被 SupplierOrder 引用 |
| Supplier | supplierCode(唯一,S0001)、名称、税号、银行、serviceArea、status | → contracts / supplierPackages / supplierOrders |
| MachineModel | brand+modelName(唯一)、deviceType(black_white/color)、status | m-n 双侧套餐 |
| CustomerPackage | packageCode+version(唯一)、月租/免费额度/超印单价(Decimal)、customerId(空=标准)、effectiveFrom、status | m-n 机型；→ customerOrderItems；Restrict customer |
| SupplierPackage | 同上，supplierId NOT NULL | → supplierOrderItems |
| CustomerOrder | orderNo(唯一,YYYYMMDD+NN 与服务端订单共序列)、customerId/locationId/customerContractId(NOT NULL, Restrict)、orderDate、status(draft/confirmed/completed/cancelled)、orderAttachmentUrl | → items(Cascade) |
| CustomerOrderItem | orderId(Cascade)、customerPackageId(Restrict)、quantity、plannedEntryDate(DB 可空，表单必填)、remark | → printers |
| SupplierOrder / SupplierOrderItem | 同客户侧结构 | → printers |
| Printer | printerCode(唯一)、supplierAssetCode(NOT NULL)、machineModelId/customerOrderItemId/**supplierOrderItemId(三者均 NOT NULL, Restrict)**、entryDate/exitDate、初始读数、status(draft/active/replaced/removed)、previousPrinterId(唯一,自关联)、qrToken(唯一) | → meterReadings(Cascade) |
| MeterReading | unique(printerId, year, month)、前后读数、用量快照、photoUrl、submittedAt、status(submitted/adjusted)、adminNote、updatedBy | Cascade 随打印机 |

### 页面（App Router）

- 后台 `(admin)`：dashboard、customers（含 locations 嵌套 CRUD）、suppliers、customer-contracts、supplier-contracts、machine-models、customer-packages、supplier-packages、customer-orders、supplier-orders、printers（new/edit/detail/replace/remove）、meter-readings（列表 + 调整）
- 公开：`/meter/[token]`（免登录抄表）、`/login`、`/api/files/[...key]`（S3 文件流）

### Server Actions

- `master-data`：客户/供应商/地点/双侧合同 CRUD + C0001/S0001 自动编码
- `catalog`：机型、双侧套餐（含版本复制）
- `orders`：双侧订单 CRUD + 引用校验 + 数量不得低于已部署守卫 + 有打印机禁删
- `printers`：CRUD + 换机（事务）+ 撤机 + 历史机禁删禁改
- `meter`：公开提交（窗口/照片/读数校验）+ 管理员调整

### Settlement / 附件 / 测试

- `src/lib/settlement.ts`：decimal.js 精确计算，**单打印机 × 单月**：按天折算月租/额度（进场计入、退场不计）、超印、应收/应付/毛利；展示在打印机详情
- 附件：S3 兼容对象存储（本地 MinIO），合同/订单附件经 `/api/files/` 打开
- 测试：75 个（8 个 lib 单测文件 + 1 个数据库集成测试含 V1 五场景）

---

## 11.2 新旧模型映射

**结论：直接把现有 `CustomerOrder` 演进为新的核心 `Order`**（按你的优先要求），不新建 Deal 模型。`CustomerOrderItem` 演进为 `OrderItem`。其余：

| 当前 Model | 处置 | 原因 |
|---|---|---|
| Customer | 修改（UI 轻量化） | 保留全部字段（含 customerType、银行），新 UI 只突出主体资料；不再承担 Location/合同管理入口 |
| **CustomerOrder → Order** | 修改（核心演进） | 新增 supplierId、installationAddress、startDate、endDate、billingCycle、depositAmount、depositReceivedDate、contractAttachmentUrl；orderNo 生成器复用 |
| CustomerOrderItem → OrderItem | 修改 | 保留 package+quantity；plannedEntryDate 弃用（进场在 Printer 层）；不再独立暴露 |
| Location | 废弃候选（两步走） | TASK 12-17：DB 保留、UI 删除、Order.locationId 可空化；TASK 18 后评估物理删除 |
| CustomerFrameworkContract | 隐藏 | DB 保留保护历史合同/附件；新合同 = Order.contractAttachmentUrl |
| SupplierFrameworkContract | 隐藏 | 同上 |
| SupplierOrder / SupplierOrderItem | 隐藏 | DB 保留；Printer.supplierOrderItemId 可空化；新流程不再创建 |
| CustomerPackage → 套餐 | 保留（改名） | 版本机制完整保留，历史引用不受影响 |
| SupplierPackage | 隐藏 | DB 保留；结算供应商侧暂以其兼容计算，新流程不要求维护 |
| Supplier | 保留（轻量） | Order 直接 supplierId 关联 |
| MachineModel → 机型库 | 保留（改名） | 不变 |
| Printer | 修改 | supplierAssetCode 隐藏（列保留）；supplierOrderItemId 可空；进场仍挂 OrderItem；换机/撤机逻辑不动 |
| MeterReading | **保留不动** | 成熟模块，零重写 |
| AdminUser/AdminSession | 保留 | 不涉及 |

---

## 11.3 Gap Analysis（当前 → 目标）

**Schema**
- CustomerOrder 缺：supplierId、installationAddress、startDate、endDate、billingCycle、押金两字段、contractAttachmentUrl
- Printer.supplierOrderItemId / CustomerOrder.locationId / customerContractId 均为 NOT NULL，新流程下必须可空
- OrderStatus 无 active（现为 confirmed）；缺 BillingCycle enum

**Business Logic**
- 新建订单强依赖 Location + 客户框架合同（校验 + 表单联动）→ 需改为只选 Customer + 手填安装地址
- 押金无概念 → 需自动计算（Σquantity × ¥2,000）+ depositReceivedDate 状态表达
- endDate 无默认 +3 年 −1 天规则
- 数量守卫是硬拦截 → 需改为「风险提示 + 仅完整性硬拦截（有打印机的明细行不可删）」
- 订单无「结束订单」操作
- 部署 printer 必须选供应商订单明细 → 改为可选/移除

**UI**
- 一级菜单 12 项 → 收敛为 6 项（首页/客户/订单/供应商/套餐/机型库）
- Order 详情页需重做为一页总览（信息+明细+部署进度+进场入口+押金+双附件+抄表结算）
- 客户/供应商详情移除 Location/合同管理体验，改为 Order/Printer 视角
- 打印机列表降级为次级管理工具；抄表管理从一级菜单撤下（入口收进首页与订单页）

**Contract/File**
- 单一 orderAttachmentUrl → 双槽（contractAttachmentUrl + orderAttachmentUrl），支持上传/打开/替换
- 合同自动生成（《文印管理服务合同》+《交付确认单》）：未来 TASK，本阶段不实现

**Printer**
- 进场表单需移除供应商明细必填、隐藏 supplierAssetCode
- printerCode 规则：有供应商编码用其编码；无则系统生成（保留现有唯一约束即可）

**MeterReading**：无 Gap。

**Settlement**
- 现状单打印机粒度 → 需新增 Order 级聚合：每台 Printer 独立算额度（现状已满足「额度不共享」），再按 Order 汇总客户应收
- billingCycle 仅展示，不改变计算
- 供应商侧：维持现有兼容计算，UI 不强调

**Dashboard**
- 新增：履约中订单数、押金未收订单数；（可选）本月应收/应付/毛利合计

**Validation / Tests**
- orders/printers 校验规则需重写；integrity 测试需新增 Order 押金/状态/聚合断言

---

## 11.4 风险评估

| 修改 | 风险 | 说明 |
|---|---|---|
| Printer.supplierOrderItemId 可空化 | **High** | 影响现有换机事务、部署校验、结算供应商侧；需同步改 actions + 完整性测试 |
| Order 新字段历史回填（尤其 supplierId） | **High** | 历史 CustomerOrder 无供应商信息，只能经 Printer→SupplierOrderItem 反推；无打印机的旧订单供应商可能未知 → supplierId 必须可空，新订单 UI 必填 |
| locationId / customerContractId 可空化 | Medium | 影响订单表单、校验、详情页展示；需保留旧行链接 |
| OrderStatus confirmed→active 改名 | Medium | 涉及全部状态判断/标签/徽章；Postgres enum 改名本身低风险 |
| 数量守卫由硬拦截改提示 | Medium | 有打印机的明细行物理上不可删（FK 保护历史），需精确区分「业务软限制」与「完整性硬限制」 |
| Order 级结算聚合 | Low | 纯新增展示逻辑，复用现有 computeSettlement |
| 双附件槽 | Low | 复用 object-storage，新增一列 |
| 押金计算 | Low | 派生字段，服务端计算快照 |
| UI 导航重构 | Low | 路由级改动，旧路由用 redirect 保留 |

**历史数据保护红线**（来自 §40，全部可满足）：Printer/MeterReading/Package Version/Settlement 计算逻辑零破坏；附件对象不动；旧表全部保留；每个 migration 均可独立回滚。

---

## 11.5 数据迁移方案

原则：全部 additive + 可空化，不 DROP 任何表/列；分两个 migration 落地。

**Migration 1（TASK 12，Schema 演进）**

新增列（CustomerOrder 表）：
- `supplierId String?` → FK Supplier Restrict（可空：历史行允许未知）
- `installationAddress String?`（新订单必填校验在应用层）
- `startDate Date? @db.Date`、`endDate Date? @db.Date`
- `billingCycle String? @default("monthly")`（暂用 string，避免 enum 变更叠加风险）
- `depositAmount Decimal(10,2)?`
- `depositReceivedDate Date? @db.Date`
- `contractAttachmentUrl String?`

可空化：
- `CustomerOrder.locationId`、`customerContractId` → `String?`（关系改可选，保留旧链接）
- `Printer.supplierOrderItemId` → `String?`（关系改可选）
- `CustomerOrderItem.plannedEntryDate` 已可空，不再使用

**Migration 2（TASK 12，数据回填，同一迁移文件内用 SQL）**

- `installationAddress`：`= locationName || '（' || address || '）'`（来自关联 Location，含你现有的 1 条真实数据）
- `startDate`：缺省 = orderDate；`endDate`：缺省 = startDate + 3 年 − 1 天（历史行也按规则补，管理员可改）
- `billingCycle`：全部 'monthly'
- `depositAmount`：`= (SELECT SUM(quantity) FROM customer_order_items WHERE order_id = id) × 2000`，`depositReceivedDate = NULL`（历史押金收款状态未知，默认未收，由你人工补录）
- `supplierId`：经 `Printer → supplierOrderItem → supplierOrder.supplierId` 反推该订单主要供应商（取 DISTINCT 第一个）；推不出则 NULL

**历史附件**：全部原地保留。旧合同附件在 CustomerFrameworkContract.attachmentUrl，新 UI 在订单详情对已关联旧合同的订单显示「历史框架合同附件」只读链接。

**Rollback**：实施前 `pg_dump` 全量备份；每个 migration 独立文件，`prisma migrate resolve` + 还原备份即可；回填逻辑全部为 UPDATE，无破坏性 DDL。

---

## 11.6 UI 重构方案

**一级菜单（最终）**：首页 `/dashboard`、客户 `/customers`、订单 `/orders`、供应商 `/suppliers`、套餐 `/packages`、机型库 `/machine-models`。

| 旧页面 | 处置 |
|---|---|
| customer-orders/* | **演进**为 /orders/*（旧路径 308 → /orders） |
| suppliers/* | 保留，详情页移除合同管理按钮，改 Order/Printer 视图 |
| customers/* | 保留，删除「新增 Location/新增客户合同」入口与 Locations 管理区，改为订单+打印机列表 |
| customer-packages/* | 保留，导航改名「套餐」，路径可留旧或 redirect |
| machine-models/* | 保留，改名「机型库」 |
| printers/* | **撤出导航**，保留为次级管理页（订单详情为主要入口） |
| meter-readings | **撤出导航**，入口并入首页统计卡与订单详情 |
| supplier-orders/*、supplier-packages/* | 导航移除，路由保留只读（DEBUG 入口），新建按钮下线 |
| customer-contracts/*、supplier-contracts/* | 导航移除；保留只读历史页（保护旧附件可达） |
| customers/[id]/locations/* | 下线（Location 不再由用户维护） |

订单详情页（TASK 14 核心交付）：单页六区块——A 订单信息（含结束订单按钮）/ B 套餐明细（+添加套餐，显示 已进场 n/quantity）/ C 合同文件+订单附件双槽 / D 押金（应收自动算 + 收款日期）/ E 设备（按明细分组：进场按钮、换机、撤机、QR）/ F 抄表与结算（本月应抄/已抄/未抄 + 各机用量 + Order 本月应收 + 历史月份）。

---

## 11.7 推荐 TASK 12 onward

| TASK | 范围 | 验收 |
|---|---|---|
| **TASK 12｜Schema 演进与兼容迁移** | Migration 1+2（新列、可空化、回填）、prisma 校验、全量回归、pg_dump 备份脚本 | migrate status 通过；75 测试仍全绿；真实试点数据回填正确（地址/押金/日期可核查） |
| **TASK 13｜Order 核心业务流** | orders actions 重写：新建/编辑 Order（Customer+供应商+安装地址+多套餐明细+起止日期默认规则+billingCycle+双附件）；OrderStatus confirmed→active；旧 customer-orders 路由 redirect；数量硬守卫改风险提示（仅保留有打印机明细行不可删的完整性拦截） | 不建 Location/合同可独立建单；endDate 默认 +3y−1d；押金自动 ¥2,000/台 |
| **TASK 14｜订单详情聚合页** | 六区块单页详情 + 结束订单（有运行中设备时弹确认不硬拦）+ 部署进度 | 一张订单页看懂全生命周期 |
| **TASK 15｜Printer 进场与生命周期适配** | 进场表单移除供应商明细必填、隐藏 supplierAssetCode、printerCode 生成规则；换机/撤机回归 | 新流程不触碰 SupplierOrder；TASK 10 场景 3/5 仍通过 |
| **TASK 16｜Settlement 适配** | Order 级应收聚合（按 Printer 独立计算→求和，额度不共享）；billingCycle 展示；工作台应收/应付/毛利合计 | 验收示例数值不变；聚合=逐机和 |
| **TASK 17｜导航与旧 UI 收敛** | 一级菜单 6 项；11.6 全表执行 | 一级菜单无 Location/合同/供应商订单等 |
| **TASK 18｜兼容验证与收尾** | 扩展 integrity 测试（押金/状态/聚合/可空关系）；docs/README 收尾；评估 Location 等物理删除（默认不删） | 新增用例全绿；文档同步 |

**刻意不实现**（避免范围蔓延）：合同 PDF 自动生成（§17，建议 TASK 19+ 单独立项）、部分押金/分期收款、供应商侧结算深化、Location/旧合同表物理删除（稳定运行一段时间后再议）。

---

*本报告基于基线 `b6365f1` 的真实代码、Schema、Migration 与数据库状态评估。*
