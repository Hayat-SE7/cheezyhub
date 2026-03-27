const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('000000', 10);
  const staff = await prisma.staff.update({
    where: { username: 'cashier1' },
    data:  { pinHash: hash, isActive: true },
  });
  console.log('Fixed:', staff.username, staff.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
