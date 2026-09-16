"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSession, deleteAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LoginState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    return { error: "请输入有效的邮箱和密码。" };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: input.data.email.toLowerCase() },
  });

  const passwordMatches = admin
    ? await compare(input.data.password, admin.passwordHash)
    : false;

  if (!admin || admin.status !== "active" || !passwordMatches) {
    return { error: "邮箱或密码不正确。" };
  }

  await createAdminSession(admin.id);
  redirect("/dashboard");
}

export async function logout() {
  await deleteAdminSession();
  redirect("/login");
}
