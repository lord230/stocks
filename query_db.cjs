const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_HPp2oxjbWO6q@ep-orange-waterfall-ao5qh5o3.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
sql`SELECT id, name, entry, target, sl FROM stock_prices`.then(rows => {
  console.log("DB Rows:", rows);
}).catch(console.error);
