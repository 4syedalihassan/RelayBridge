import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.globalRelayConfig.findUnique({ where: { id: 'default' } });
  if (!existing) {
    await prisma.globalRelayConfig.create({
      data: {
        clientId: process.env.GR_CLIENT_ID ?? '',
        clientSecret: process.env.GR_CLIENT_SECRET ?? '',
      },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
