require('dotenv').config();
const db = require('./config/db');

async function test() {
  try {
    const [users] = await db.query('SELECT * FROM users');
    console.log('Users in DB:');
    console.log(users);
    
    const [officers] = await db.query('SELECT * FROM officers');
    console.log('Officers in DB:');
    console.log(officers);
    
    process.exit(0);
  } catch (err) {
    console.error('Database query failed:', err);
    process.exit(1);
  }
}

test();
