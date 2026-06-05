const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking database metrics ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found in database.');
    return;
  }
  console.log(`Found user: ${user.email} (${user.id})`);
  
  const fitnessEntries = await prisma.fitnessEntry.findMany({ where: { userId: user.id }, take: 10 });
  console.log('FitnessEntries:', fitnessEntries);
  
  const workoutEntries = await prisma.workoutEntry.findMany({ where: { userId: user.id }, take: 10 });
  console.log('WorkoutEntries:', workoutEntries);
  
  const dailyAnalytics = await prisma.dailyAnalytics.findMany({ where: { userId: user.id }, take: 5, orderBy: { date: 'desc' } });
  console.log('DailyAnalytics (last 5):', dailyAnalytics);
  
  const cognitiveSnapshot = await prisma.userCognitiveSnapshot.findUnique({ where: { userId: user.id } });
  console.log('Cognitive Snapshot:', cognitiveSnapshot);
  
  const tasksCount = await prisma.task.count({ where: { userId: user.id } });
  console.log(`Tasks count: ${tasksCount}`);
  
  const checklistCount = await prisma.checklistItem.count({ where: { userId: user.id } });
  console.log(`ChecklistItem count: ${checklistCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
