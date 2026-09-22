import { redirect } from "next/navigation";

// 客户合同模块已收敛为只读历史存档（TASK 17），编辑入口下线。
export default function EditCustomerContractPage() {
  redirect("/customer-contracts");
}
