const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function classifyStressLevel(score) {
  if (score <= 15) return 'minimal';
  if (score <= 30) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 70) return 'elevated';
  if (score <= 85) return 'high';
  return 'critical';
}

async function testDbBiometrics() {
  console.log('--- Testing Real-world Database-Driven Biometrics Ingestion ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found in database.');
    return;
  }
  
  console.log(`Loaded User: ${user.email} (${user.id})`);
  const userId = user.id;
  const now = new Date();
  
  // 1. Fetch active tasks for this user
  const activeTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ['todo', 'in-progress'] },
    }
  });
  
  let overdueTasksCount = 0;
  for (const t of activeTasks) {
    if (t.dueDate) {
      try {
        const d = new Date(t.dueDate);
        if (d < now) {
          overdueTasksCount++;
        }
      } catch (e) {}
    }
  }
  
  // 2. Fetch latest fitness entries
  const latestFitness = await prisma.fitnessEntry.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  });
  
  const steps = latestFitness ? latestFitness.steps : 0;
  
  // 3. Fetch latest workout entries
  const latestWorkout = await prisma.workoutEntry.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  });
  
  const activeMinutes = latestWorkout ? latestWorkout.durationMinutes : 0;
  
  // 4. Fetch latest daily analytics
  const latestAnalytics = await prisma.dailyAnalytics.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  });
  
  const productivity = latestAnalytics ? latestAnalytics.productivityScore : 80;
  const dailyTime = latestAnalytics ? latestAnalytics.totalTime : 0;
  
  // 5. Calculate composite stress score
  let stress = 50;
  stress += overdueTasksCount * 8;
  
  if (productivity < 70) {
    stress += 15;
  } else if (productivity >= 90) {
    stress -= 12;
  }
  
  if (activeMinutes > 0) {
    stress -= Math.min(20, activeMinutes * 0.5);
  }
  
  if (steps > 10000) {
    stress -= 10;
  } else if (steps > 5000) {
    stress -= 5;
  }
  
  const userStressScore = Math.max(12, Math.min(95, Math.round(stress)));
  const stressLevel = classifyStressLevel(userStressScore);
  
  // 6. Sleep estimation
  const totalSleepMinutes = Math.max(280, Math.round(450 - (userStressScore - 50) * 1.5));
  const sleepEfficiency = Math.max(65, Math.min(98, Math.round(95 - (userStressScore - 50) * 0.2 + (activeMinutes > 0 ? 3 : 0))));
  
  // 7. Heart rate estimation
  const averageBpm = Math.round(62 + (userStressScore - 50) * 0.22);
  
  console.log('\n--- Computed Biometric Signals ---');
  console.log(`- Overdue Tasks: ${overdueTasksCount}`);
  console.log(`- Daily Steps: ${steps}`);
  console.log(`- Workout Duration: ${activeMinutes} minutes`);
  console.log(`- Productivity Score: ${productivity}%`);
  console.log(`- Computed Stress Score: ${userStressScore} (${stressLevel})`);
  console.log(`- Estimated Sleep: ${totalSleepMinutes} min, ${sleepEfficiency}% efficiency`);
  console.log(`- Estimated Resting Heart Rate: ${averageBpm} BPM`);
  
  // 8. Update/Upsert the UserCognitiveSnapshot in the database
  const focusTimeToday = Math.round(dailyTime / 60);
  let fatigueEstimate = 'low';
  if (userStressScore > 75) fatigueEstimate = 'high';
  else if (userStressScore > 45) fatigueEstimate = 'medium';
  
  console.log('\n--- Saving snapshot to the database ---');
  const snapshot = await prisma.userCognitiveSnapshot.upsert({
    where: { userId },
    update: {
      focusTimeToday,
      productivityScore: productivity,
      fatigueEstimate,
      overdueTasks: overdueTasksCount,
      lastInsightGeneratedAt: now,
    },
    create: {
      userId,
      focusTimeToday,
      productivityScore: productivity,
      fatigueEstimate,
      overdueTasks: overdueTasksCount,
      lastInsightGeneratedAt: now,
    },
  });
  
  console.log('✅ Successfully upserted UserCognitiveSnapshot:');
  console.log(snapshot);
}

testDbBiometrics()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
