import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: '***REMOVED***',
});

await client.connect();

const result = await client.query('SELECT COUNT(*) as total FROM "User"');
console.log('👥 Total usuarios:', result.rows[0].total);

// También traemos algunos datos útiles
const recent = await client.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
  FROM "User"
`);

const stats = recent.rows[0];
console.log('📊 Estadísticas:');
console.log('  Total:', stats.total);
console.log('  Últimos 7 días:', stats.last_7_days);
console.log('  Últimos 30 días:', stats.last_30_days);

await client.end();
