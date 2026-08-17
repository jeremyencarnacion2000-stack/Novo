import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      role: true,
      plan: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTotal users: ${users.length}\n`);
  console.log('='.repeat(100));

  const testPatterns = [
    /test/i, /prueba/i, /demo/i, /fake/i, /example\.com/i, /temp/i,
    /noreply/i, /admin/i, /^user\d+/i, /mailinator/i, /guerrilla/i,
    /yopmail/i, /throwam/i, /trashmail/i, /10minutemail/i,
  ];

  const testUsers = [];
  const realUsers = [];

  users.forEach((u, i) => {
    const isTest = testPatterns.some(p => p.test(u.email) || p.test(u.name || ''));
    const row = `${String(i+1).padStart(3)}. [${isTest ? 'TEST' : 'REAL'}] ${(u.name || 'No name').padEnd(30)} | ${u.email.padEnd(45)} | ${u.plan.padEnd(6)} | ${u.createdAt.toISOString().slice(0,10)}`;
    console.log(row);
    if (isTest) testUsers.push(u);
    else realUsers.push(u);
  });

  console.log('='.repeat(100));
  console.log(`\n📊 RESUMEN:`);
  console.log(`   ✅ Usuarios reales : ${realUsers.length}`);
  console.log(`   🧪 Cuentas de prueba: ${testUsers.length}`);
  console.log(`\n🧪 CUENTAS DE PRUEBA DETECTADAS:`);
  testUsers.forEach(u => console.log(`   - ${u.email} (${u.name || 'sin nombre'})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
