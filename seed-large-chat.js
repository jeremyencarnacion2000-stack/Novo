const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  console.log('--- Seeding large chat conversation for stress testing ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found to associate the conversation.');
    return;
  }
  console.log(`Seeding for user: ${user.email} (${user.id})`);

  // Generate 2000 alternating messages
  const messages = [];
  const words = ["cognición", "operativo", "sistema", "productividad", "enfoque", "arquitectura", "interfaz", "diseño", "desarrollo", "código", "optimización", "pantalla", "usuario", "flujo", "datos", "estado", "sincronización", "memoria"];
  
  for (let i = 1; i <= 2000; i++) {
    const role = i % 2 === 1 ? 'user' : 'assistant';
    // Create random-ish text length
    const phraseCount = 2 + Math.floor(Math.random() * 8);
    const contentParts = [];
    for (let p = 0; p < phraseCount; p++) {
      const idx = Math.floor(Math.random() * words.length);
      contentParts.push(words[idx]);
    }
    const sentence = contentParts.join(' ') + `. Mensaje número ${i} de la prueba de stress de Novo Cognitive OS.`;
    
    messages.push({
      id: `stress-${i}-${crypto.randomUUID()}`,
      role,
      content: sentence,
      timestamp: new Date(Date.now() - (2000 - i) * 60000).toISOString()
    });
  }

  const largeConv = await prisma.aIConversation.create({
    data: {
      userId: user.id,
      title: 'Stress Test: 2000 Messages',
      messages: messages
    }
  });

  console.log(`Successfully created conversation: ${largeConv.title} (${largeConv.id}) with 2000 messages.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
