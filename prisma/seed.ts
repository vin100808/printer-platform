import { PrismaClient, RecordStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";

const envSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(10),
  ADMIN_NAME: z.string().min(1).default("系统管理员"),
});

async function main() {
  const env = envSchema.parse(process.env);
  const prisma = new PrismaClient();

  try {
    const passwordHash = await hash(env.ADMIN_PASSWORD, 12);

    await prisma.adminUser.upsert({
      where: { email: env.ADMIN_EMAIL.toLowerCase() },
      update: {
        name: env.ADMIN_NAME,
        passwordHash,
        status: RecordStatus.active,
      },
      create: {
        email: env.ADMIN_EMAIL.toLowerCase(),
        name: env.ADMIN_NAME,
        passwordHash,
      },
    });

    console.info(`Administrator ready: ${env.ADMIN_EMAIL.toLowerCase()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
