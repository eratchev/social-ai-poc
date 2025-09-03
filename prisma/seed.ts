// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('Starting seed…');
async function main() {
  // Create or reuse a dev user
  const user = await prisma.user.upsert({
    where: { handle: 'devuser' },
    update: {},
    create: {
      handle: 'devuser',
      displayName: 'Dev User',
    },
  });

  // Create or reuse a dev room owned by the user
  const room = await prisma.room.upsert({
    where: { code: 'DEVROOM' },
    update: {},
    create: {
      code: 'DEVROOM',
      createdBy: user.id,
    },
  });

  console.log('Seeded:', { user, room });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  