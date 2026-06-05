const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Noval Properties Catalog Ingestion Script ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ Error: No user found in the database to link properties to.');
    return;
  }
  
  console.log(`Linking properties to user: ${user.email} (${user.id})`);
  
  const properties = [
    {
      title: 'Atlántida Premium Residences',
      description: 'A groundbreaking premium development in Bávaro-Punta Cana featuring a massive concentric pool structure, private beach clubs, and elite concierge services.',
      status: 'in-progress',
      priority: 'high',
      startDate: '2026-01-15',
      dueDate: '2028-12-31',
      progress: 35.0,
      tags: JSON.stringify(['noval-properties', 'punta-cana', 'luxury', 'beachfront']),
      notes: 'Acquisition strategy: Target premium high-yield units in the central ring. ROI estimate: 11.4% annually.'
    },
    {
      title: 'Oceana Luxury Lagoon',
      description: 'A breathtaking residential community designed around a gigantic saltwater lagoon in Samaná. Focuses on premium eco-luxury living and wellness.',
      status: 'not-started',
      priority: 'high',
      startDate: '2026-06-01',
      dueDate: '2029-06-30',
      progress: 0.0,
      tags: JSON.stringify(['noval-properties', 'samana', 'eco-luxury', 'lagoon']),
      notes: 'Awaiting architectural designs and environmental approval certificates. Excellent appreciation potential.'
    },
    {
      title: 'Harbor Bay Cap Cana',
      description: 'Ultra-exclusive harbor-front condos located in the prestigious Cap Cana Marina. Modern architecture featuring private docks and infinity pools overlooking the yacht slips.',
      status: 'completed',
      priority: 'high',
      startDate: '2024-03-01',
      dueDate: '2026-05-01',
      progress: 100.0,
      tags: JSON.stringify(['noval-properties', 'cap-cana', 'marina', 'exclusive']),
      notes: 'Fully delivered and closed. Yield payments from rental management program to commence in Q3 2026.'
    },
    {
      title: 'Riviera Bay Championship Golf',
      description: 'Sleek golf-side residences nestled alongside the world-class Cana Bay golf course. Optimized for golf enthusiasts and high-volume short term rentals.',
      status: 'in-progress',
      priority: 'medium',
      startDate: '2025-08-01',
      dueDate: '2027-10-31',
      progress: 60.0,
      tags: JSON.stringify(['noval-properties', 'golf', 'punta-cana', 'rentals']),
      notes: 'Construction is ahead of schedule. Interior finishes selection package completed on 2026-05-15.'
    }
  ];

  console.log('\nProcessing ingestion...');
  
  for (const prop of properties) {
    const existing = await prisma.project.findFirst({
      where: {
        userId: user.id,
        title: prop.title
      }
    });
    
    if (existing) {
      console.log(`Updating existing project: "${prop.title}"`);
      await prisma.project.update({
        where: { id: existing.id },
        data: prop
      });
    } else {
      console.log(`Creating new project: "${prop.title}"`);
      await prisma.project.create({
        data: {
          ...prop,
          userId: user.id
        }
      });
    }
  }
  
  console.log('\n✅ Successfully ingested Noval Properties projects catalog!');
}

main()
  .catch(e => console.error('❌ Ingestion failed:', e))
  .finally(() => prisma.$disconnect());
