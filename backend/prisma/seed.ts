import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@sfm.local' },
    update: {},
    create: {
      email: 'admin@sfm.local',
      passwordHash: adminHash,
      name: 'System Admin',
      role: 'super_admin',
    },
  });

  console.log('Seeded super admin  admin@sfm / Admin123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
