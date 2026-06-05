const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Productivity Projects Ingestion Script ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ Error: No user found in the database.');
    return;
  }
  
  console.log(`Ingesting projects for user: ${user.email} (${user.id})`);
  
  const projects = [
    {
      title: 'Novo Heritage Development',
      description: 'Unified luxury real estate discovery engine and transaction layer, utilizing high-performance API caching, Neon PostgreSQL, and interactive Mapbox views.',
      status: 'in-progress',
      priority: 'high',
      startDate: '2026-03-01',
      dueDate: '2026-07-31',
      progress: 85.0,
      tags: JSON.stringify(['next.js', 'postgres', 'mapbox', 'prisma']),
      notes: 'Focus on stabilizing Railway Postgres migrations and refining the Mapbox performance.'
    },
    {
      title: 'Omnicore Automation Backbone',
      description: 'Distributed event-driven infrastructure coordinating background workflows across multiple internal systems with retry queues and robust audit trails.',
      status: 'in-progress',
      priority: 'high',
      startDate: '2026-01-15',
      dueDate: '2026-08-30',
      progress: 60.0,
      tags: JSON.stringify(['typescript', 'temporal.io', 'k8s', 'queues']),
      notes: 'Adding telemetry modules to evaluate queue latencies under high transaction peaks.'
    },
    {
      title: 'Auto-Pilot AI Agents',
      description: 'Custom AI orchestrator dispatching specialized agents for advanced context retrieval and autonomous workflow execution.',
      status: 'completed',
      priority: 'medium',
      startDate: '2025-09-01',
      dueDate: '2026-02-15',
      progress: 100.0,
      tags: JSON.stringify(['llm', 'vector-db', 'langchain']),
      notes: 'Successfully deployed. Operating with 99.4% uptime and 180ms average latency.'
    },
    {
      title: 'Monolith Desktop Command Center',
      description: 'Offline-first native desktop client managing operations, local caching, and offline state synchronization.',
      status: 'completed',
      priority: 'high',
      startDate: '2024-11-01',
      dueDate: '2025-05-15',
      progress: 100.0,
      tags: JSON.stringify(['electron', 'rust', 'sqlite']),
      notes: 'Delivered to operations. Local synchronization is rock-solid.'
    },
    {
      title: 'DentalApp Clinical Portal',
      description: 'Unified dashboard for dental practices, patient management, electronic health records, and billing.',
      status: 'completed',
      priority: 'medium',
      startDate: '2024-02-01',
      dueDate: '2024-10-31',
      progress: 100.0,
      tags: JSON.stringify(['react', 'node.js', 'postgresql']),
      notes: 'Standardized operational maintenance is in place.'
    }
  ];

  console.log('\nProcessing ingestion...');
  
  for (const proj of projects) {
    const existing = await prisma.project.findFirst({
      where: {
        userId: user.id,
        title: proj.title
      }
    });
    
    if (existing) {
      console.log(`Updating project: "${proj.title}"`);
      await prisma.project.update({
        where: { id: existing.id },
        data: proj
      });
    } else {
      console.log(`Creating project: "${proj.title}"`);
      await prisma.project.create({
        data: {
          ...proj,
          userId: user.id
        }
      });
    }
  }
  
  console.log('\n✅ Successfully ingested productivity projects catalog!');
}

main()
  .catch(e => console.error('❌ Ingestion failed:', e))
  .finally(() => prisma.$disconnect());
