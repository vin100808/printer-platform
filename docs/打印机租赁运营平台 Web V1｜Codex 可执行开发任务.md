# 打印机租赁运营平台 Web V1
## Codex 可执行开发任务

---

# 0. 开发总原则

这是一个打印机租赁中间商内部使用的业务运营系统。

第一版目标不是做 ERP，不做复杂审批，不做 AI Agent。

V1 只解决：

1. 客户管理
2. 供应商管理
3. 合同管理
4. Machine Model 管理
5. Customer Package / Supplier Package 管理
6. 客户订单
7. 供应商订单
8. Printer 台账
9. 新增 / 换机 / 撤机
10. 二维码抄表
11. 月度运营结算
12. 基础查询

技术原则：

- 单体 Web App
- 不做微服务
- 不做 Kubernetes
- 数据库存 PostgreSQL
- 文件和照片使用对象存储
- 前后台可以使用同一套 Web 项目
- 优先保证数据关系和业务逻辑正确
- UI 第一版以清晰、可用为主
- 不为了所谓“企业级架构”提前增加复杂度

建议技术栈：

- Next.js
- TypeScript
- PostgreSQL
- Prisma 或同类 ORM
- 对象存储
- 简单账号登录
- Tailwind / 常规组件库

---

# TASK 01｜初始化项目与数据库骨架

## 目标

建立可以长期继续开发的项目骨架。

## 要完成

初始化：

- Next.js
- TypeScript
- PostgreSQL
- ORM
- 环境变量
- Migration
- 基础后台布局
- 简单管理员登录

建立以下基础枚举：

### CustomerType

- internal
- external

### RecordStatus

- active
- inactive

### PrinterStatus

- draft
- active
- replaced
- removed

### OrderStatus

- draft
- confirmed
- completed
- cancelled

### DeviceType

- black_white
- color

---

## 验收标准

能够：

- 启动项目
- 登录后台
- 成功连接 PostgreSQL
- Migration 正常执行
- 数据库可以新增测试数据
- 项目目录结构清晰
- README 写明本地启动步骤

---

# TASK 02｜客户、供应商、地点、合同

## 目标

先完成所有基础主数据。

---

## Customer

字段：

- id
- customerCode
- customerName
- customerType

公司资料：

- taxpayerIdentificationNo
- registeredAddress

银行资料：

- bankName
- bankAccountName
- bankAccountNo

联系人：

- contactName
- contactPhone

其他：

- status
- remark
- createdAt
- updatedAt

---

## Supplier

字段：

- id
- supplierCode
- supplierName

公司资料：

- taxpayerIdentificationNo
- registeredAddress

银行资料：

- bankName
- bankAccountName
- bankAccountNo

联系人：

- contactName
- contactPhone

其他：

- serviceArea
- status
- remark
- createdAt
- updatedAt

---

## Location

字段：

- id
- customerId
- locationCode
- locationName
- address
- contactName
- contactPhone
- status
- remark

规则：

一个 Customer 可以有多个 Location。

一个 Location 只能属于一个 Customer。

registeredAddress 与 Location 完全独立。

registeredAddress 是公司工商/合同地址。

Location 是打印机实际部署地点。

---

## CustomerFrameworkContract

字段：

- id
- contractNo
- contractName
- effectiveDate
- expiryDate
- status
- attachmentUrl
- remark

需要支持：

一份客户框架合同可以关联多个 Customer。

一个 Customer 也可以存在多份历史框架合同。

---

## SupplierFrameworkContract

字段：

- id
- supplierId
- contractNo
- contractName
- effectiveDate
- expiryDate
- status
- attachmentUrl
- remark

---

## 页面

建立：

- 客户列表
- 客户详情
- 新增客户
- 编辑客户
- 供应商列表
- 供应商详情
- 新增供应商
- 编辑供应商
- Location 管理
- 客户合同管理
- 供应商合同管理

---

## 验收标准

点开 Customer 可以看到：

- 基础资料
- 公司注册地址
- 银行资料
- Locations
- 客户合同

点开 Supplier 可以看到：

- 基础资料
- 银行资料
- 供应商合同

合同附件可以上传并打开。

---

# TASK 03｜Machine Model 与 Package

## 目标

完成系统的标准产品菜单。

---

## MachineModel

字段：

- id
- brand
- modelName
- deviceType
- status
- remark

deviceType：

### black_white

只支持黑白抄表。

### color

需要同时记录：

- 黑白读数
- 彩色读数

---

## CustomerPackage

字段：

- id
- packageCode
- packageName

价格：

- monthlyRent
- monthlyFreeBwEquivalent
- overageRateBwEquivalent

归属：

- customerId，可为空

版本：

- version
- effectiveFrom
- status

其他：

- remark
- createdAt
- updatedAt

规则：

customerId 为空：

代表标准套餐。

customerId 有值：

代表客户专属套餐。

---

## SupplierPackage

字段：

- id
- supplierId
- packageCode
- packageName
- monthlyRent
- monthlyFreeBwEquivalent
- overageRateBwEquivalent
- version
- effectiveFrom
- status
- remark

---

## Package 与 MachineModel

CustomerPackage 和 SupplierPackage 均支持关联多个 MachineModel。

使用多对多关系。

---

## 套餐历史规则

禁止直接覆盖历史价格。

例如：

SupplierPackage：

V1：

400 元/月

后来重新议价：

360 元/月

必须：

- 原 V1 保留
- 新建 V2
- V1 可以 inactive
- 历史业务继续引用 V1

CustomerPackage 同样规则。

---

## 固定计费规则

整个系统固定：

1 张黑白：

1 BW Equivalent

1 张彩色：

10 BW Equivalent

---

## 页面

实现：

- Machine Model 列表
- Machine Model 新增编辑
- Customer Package 列表
- Supplier Package 列表
- 套餐详情
- 启用 / 停用
- 套餐适配 MachineModel 配置

---

## 验收标准

可以建立：

CustomerPackage A

450 元/月

16000 免费 BW Equivalent

超印 0.03

并关联：

- Model A
- Model B
- Model C

能够复制一个套餐并修改价格形成新版本。

---

# TASK 04｜客户订单与供应商订单

## 目标

实现业务需求和采购需求。

---

# CustomerOrder

字段：

- id
- orderNo
- customerId
- locationId
- customerContractId
- orderDate
- status
- orderAttachmentUrl
- remark
- createdAt
- updatedAt

规则：

一个 CustomerOrder 只属于一个 Location。

订单附件需要支持上传。

---

# CustomerOrderItem

字段：

- id
- customerOrderId
- customerPackageId
- quantity
- plannedEntryDate
- remark

重要规则：

CustomerOrderItem：

quantity = 2

表示客户买了两台服务。

未来应该产生：

Printer A

Printer B

CustomerOrderItem 与 Printer：

1:N

---

# SupplierOrder

字段：

- id
- supplierId
- supplierContractId
- orderDate
- status
- orderAttachmentUrl
- remark

---

# SupplierOrderItem

字段：

- id
- supplierOrderId
- supplierPackageId
- quantity
- plannedEntryDate
- remark

SupplierOrderItem 与 Printer：

1:N

---

## 非常重要

不要建立：

CustomerOrder 1:1 SupplierOrder

数据库不要做这个限制。

真正把客户侧和供应商侧连接起来的是：

Printer。

即：

CustomerOrderItem

↓

Printer

↑

SupplierOrderItem

---

## 新增机器规则

客户新增机器：

必须新建 CustomerOrder。

供应商侧也必须存在相应 SupplierOrder。

禁止通过修改历史 OrderItem.quantity 表示新增机器。

---

## 页面显示

CustomerOrderItem 显示：

订单数量：

2

当前已部署：

1 / 2

部署状态：

- 未部署
- 部分部署
- 已部署

这个状态可以动态计算，不必存数据库。

SupplierOrderItem 同理。

---

## 验收标准

创建：

CustomerOrder：

Customer A

Location A

Package A × 2

之后系统能显示：

0 / 2 已部署

并能够进入后续 Printer 创建流程。

---

# TASK 05｜Printer 核心台账

## 目标

实现整个系统最核心的数据对象。

---

## Printer

字段：

- id
- printerCode
- supplierAssetCode

关系：

- machineModelId
- customerOrderItemId
- supplierOrderItemId

时间：

- entryDate
- exitDate

初始读数：

- initialBwReading
- initialColorReading

状态：

- status

换机关系：

- previousPrinterId

二维码：

- qrToken

其他：

- remark
- createdAt
- updatedAt

---

## 不需要

不要 serialNumber。

printerCode 编码规则暂时不要写死。

系统只需要保证：

printerCode 可以唯一。

supplierAssetCode 可以保存。

以后业务再确定具体编号规则。

---

## 创建 Printer

创建时必须选择：

- CustomerOrderItem
- SupplierOrderItem
- MachineModel
- printerCode
- supplierAssetCode
- entryDate
- 初始读数

不要让用户重复选择：

- Customer
- Location
- CustomerContract
- Supplier
- SupplierContract
- CustomerPackage
- SupplierPackage

这些全部通过 OrderItem 自动追溯。

---

## Printer 详情页

必须一屏清楚看到：

### 客户侧

- Customer
- Location
- CustomerFrameworkContract
- CustomerOrder
- CustomerOrder 附件
- CustomerPackage

### 供应商侧

- Supplier
- SupplierFrameworkContract
- SupplierOrder
- SupplierOrder 附件
- SupplierPackage

### 设备

- printerCode
- supplierAssetCode
- MachineModel
- DeviceType
- entryDate
- exitDate
- status

### 其他

- 二维码
- MeterReading 历史

---

## 验收标准

任意一台 Printer 必须可以回答：

- 谁在用
- 放在哪里
- 客户买的是什么套餐
- 对应哪张客户订单
- 对应哪份客户合同
- 哪个供应商提供
- 供应商是什么套餐
- 对应哪张供应商订单
- 哪份供应商合同
- 什么型号
- 什么时间进场

---

# TASK 06｜新增、换机、撤机

## 目标

完成 Printer 生命周期。

---

## 新增

新增机器永远来源于新的业务订单。

流程：

新 CustomerOrder

↓

CustomerOrderItem

↓

新 SupplierOrder

↓

SupplierOrderItem

↓

新 Printer

↓

status = active

---

# 换机

只有：

原机器故障 / 损坏 / 技术原因替换

才叫换机。

不是新增业务。

---

## 换机操作

点击：

换机

旧 Printer：

- status = replaced
- exitDate = 换机日期

新 Printer：

- 新建记录
- previousPrinterId = 旧 Printer
- entryDate = 换机日期
- status = active

重新填写：

- MachineModel
- printerCode
- supplierAssetCode
- initialBwReading
- initialColorReading

客户订单关系原则上沿用原 CustomerOrderItem。

供应商关系：

如果供应商关系没变：

沿用原 SupplierOrderItem。

如果供应商发生变化：

可以关联新的 SupplierOrderItem。

---

## 撤机

点击：

撤机

填写：

exitDate

系统：

status = removed

---

## 历史保护

replaced 和 removed Printer：

- 不删除
- 不修改历史 MeterReading
- 不允许新月份抄表

---

## 验收标准

能够：

Printer A

active

执行换机后：

Printer A

replaced

Printer B

active

Printer B.previousPrinterId = Printer A

并且 Printer A 的历史抄表仍然完整。

---

# TASK 07｜二维码抄表

## 目标

实现客户无需登录即可扫码抄表。

---

## QR Token

每台 Printer 生成随机 qrToken。

例如：

a8F3k29XaP

不要直接使用自增 ID 暴露机器。

生成：

/meter/{qrToken}

---

# MeterReading

字段：

- id
- printerId

业务月份：

- readingYear
- readingMonth

读数：

- previousBwReading
- currentBwReading
- previousColorReading
- currentColorReading

计算：

- bwUsage
- colorUsage
- bwEquivalentUsage

附件：

- photoUrl

提交：

- submittedAt

状态 / 管理：

- status
- adminNote
- updatedAt
- updatedBy

---

## 数据库唯一约束

必须：

UNIQUE (
printerId,
readingYear,
readingMonth
)

即：

一台 Printer

一个年份 + 月份

只能存在一条正式 MeterReading。

---

# 抄表月份规则

例如：

2026 年 9 月的使用量：

readingYear = 2026

readingMonth = 9

客户提交时间：

2026 年 10 月 1 日至 10 月 3 日。

---

## 开放规则

统一：

每个月 1 日 00:00

到：

3 日 23:59:59

允许提交上一个自然月的 MeterReading。

---

## 页面逻辑

例如：

9 月 30 日：

本期抄表尚未开放。

10 月 1～3 日：

可以提交 9 月抄表。

10 月 4 日：

本期抄表已关闭。

---

## 已经提交

如果该 Printer 的当前业务月份已经存在 MeterReading：

显示：

本期抄表已提交，如需修改请联系管理员。

客户不能：

- 二次提交
- 修改
- 删除

后台管理员可以修改。

---

## 根据机器类型显示

MachineModel.deviceType：

### black_white

页面显示：

- 黑白读数
- 照片

不显示彩色。

### color

页面显示：

- 黑白读数
- 彩色读数
- 照片

---

## 照片

客户扫码提交：

必须上传照片。

---

## 只有 active Printer 可提交

如果：

status = replaced

或者：

status = removed

二维码页面不能产生新的 MeterReading。

只能提示：

该设备当前已停止使用。

---

## 验收标准

手机扫描二维码后无需登录。

可以：

- 看到基本设备信息
- 填读数
- 上传照片
- 提交

第二次扫码：

显示已提交。

---

# TASK 08｜运营结算

## 目标

基于 MeterReading 自动计算：

- 客户应收
- 供应商应付
- 运营毛利

暂时不是正式财务系统。

---

# 固定换算规则

bwEquivalentUsage：

bwUsage + colorUsage × 10

---

# 月租按天折算

activeDays：

根据：

entryDate

exitDate

计算该机器在当前自然月实际使用天数。

---

## Prorated Monthly Rent

actualMonthlyRent =

monthlyRent × activeDays / daysInMonth

---

## 免费额度按天折算

actualFreeQuota =

monthlyFreeBwEquivalent × activeDays / daysInMonth

---

## 超印量

overageUsage =

MAX(

bwEquivalentUsage - actualFreeQuota,

0

)

---

## 超印费用

overageFee =

overageUsage × overageRateBwEquivalent

---

# 当月金额

monthlyAmount =

actualMonthlyRent + overageFee

---

# 客户侧

使用：

CustomerPackage

计算：

customerReceivable

---

# 供应商侧

使用：

SupplierPackage

计算：

supplierPayable

---

# 毛利

operatingGrossProfit =

customerReceivable - supplierPayable

---

## 金额精度

所有金额字段必须使用 Decimal / Numeric。

不要使用 float。

---

## 页面

Printer 详情页显示当前月：

- 黑白用量
- 彩色用量
- BW Equivalent
- 实际免费额度
- 超印量
- 实际月租
- 超印费
- 客户应收
- 供应商应付
- 毛利

---

## 验收示例

CustomerPackage：

450 / 月

免费额度：

10000

超印：

0.03

机器：

9 月 20 日进场

9 月：

30 天

实际使用：

11 天

实际月租：

450 × 11 / 30 = 165

实际免费额度：

10000 × 11 / 30

如果：

黑白 8000

彩色 300

BW Equivalent：

11000

系统必须正确计算对应超印和金额。

---

# TASK 09｜后台首页与常用视图

## 目标

让业务人员真的可以日常使用。

---

## 首页

显示：

- 使用中机器数量
- 本月应抄数量
- 本月已抄数量
- 本月未抄数量
- 当前客户数
- 当前供应商数

第一版不要做复杂 BI。

---

## 客户详情

显示：

- 客户基本信息
- 银行资料
- Locations
- Framework Contracts
- Customer Orders
- active Printers
- historical Printers

---

## Supplier 详情

显示：

- Supplier 基本信息
- 银行资料
- Supplier Contracts
- Supplier Orders
- active Printers
- historical Printers

---

## Printer 列表

至少可以筛选：

- Customer
- Location
- Supplier
- MachineModel
- status

---

## MeterReading 页面

至少有：

- 本期应抄
- 已抄
- 未抄
- 历史记录

---

# TASK 10｜数据完整性与基础测试

## 目标

开发完成后防止业务数据被写坏。

---

## 必须验证的规则

### CustomerOrder

Location 必须属于 Customer。

### Printer

CustomerOrderItem 必须有效。

SupplierOrderItem 必须有效。

MachineModel 必须有效。

### MeterReading

只有 active Printer 可以新增。

### 黑白机

禁止提交 color reading。

### 彩色机

必须支持 color reading。

### MeterReading

current reading 不得低于 previous reading。

### MeterReading 唯一性

同一 Printer + year + month 只能一条。

### Package

历史使用中的 Package 不得硬删除。

只能 inactive。

### Printer

historical Printer 不得硬删除。

---

# 最终 V1 验收场景

必须完整跑通以下场景：

## Scenario 1｜新客户

创建 Customer

↓

创建 Location

↓

上传 CustomerFrameworkContract

↓

创建 CustomerOrder

↓

CustomerOrderItem：

CustomerPackage A × 2

↓

创建 SupplierOrder

↓

SupplierOrderItem：

SupplierPackage A × 2

↓

创建：

Printer 001

Printer 002

↓

两台均 active

---

## Scenario 2｜扫码抄表

10 月 1 日：

Printer 001 扫码

↓

填写 9 月读数

↓

上传照片

↓

提交

↓

后台出现 9 月 MeterReading

↓

系统自动计算：

客户应收

供应商应付

毛利

---

## Scenario 3｜坏机换机

Printer 001 故障

↓

换机

↓

Printer 001：

replaced

↓

创建 Printer 003

↓

Printer 003：

previousPrinterId = Printer 001

↓

历史抄表留在 Printer 001

↓

Printer 003 从新初始读数开始

---

## Scenario 4｜新增机器

客户后来新增 1 台。

必须：

新建 CustomerOrder

新建 CustomerOrderItem

新建 SupplierOrder

新建 SupplierOrderItem

新建 Printer

不得：

修改原 CustomerOrderItem.quantity

---

## Scenario 5｜撤机

Printer 002 撤场

↓

status = removed

↓

不能再提交新 MeterReading

↓

所有历史数据仍然可以查询

---

# 开发顺序

Codex 严格按下面顺序开发：

1. TASK 01
2. TASK 02
3. TASK 03
4. TASK 04
5. TASK 05
6. TASK 06
7. TASK 07
8. TASK 08
9. TASK 09
10. TASK 10

每完成一个 TASK：

1. 先运行测试
2. 检查数据库 Migration
3. 检查 TypeScript
4. 检查 lint/build
5. 更新 README / DEVELOPMENT_PROGRESS.md
6. 再进入下一阶段

禁止一次性跳过多个阶段。

---

# 给 Codex 的第一条指令

你正在开发一个「打印机租赁运营平台 Web V1」。

不要一次性开发整个系统。

现在只执行 TASK 01。

要求：

1. 先阅读完整开发说明。
2. 理解整体数据模型，但本轮只实现 TASK 01。
3. 不提前实现后续业务。
4. 使用简单、成熟、易维护的技术方案。
5. 不引入不必要的微服务、事件总线、复杂 DDD、Kubernetes 等架构。
6. 完成后自行运行 build、lint、type check 和必要测试。
7. 输出：
   - 本轮完成内容
   - 新增/修改文件
   - 数据库变化
   - 如何本地运行
   - 测试结果
   - 下一阶段建议
8. 如果开发说明和现有代码冲突，以开发说明为准。
9. 如果遇到不影响核心架构的小问题，选择最简单合理实现，不要停止开发反复询问。
10. 如果问题会改变数据库核心模型，再明确指出，不要自行发明业务规则。

现在开始 TASK 01。