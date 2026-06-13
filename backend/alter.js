require('dotenv').config();
const db = require('./config/db');

async function run() {
  try {
    await db.query(`ALTER TABLE users MODIFY COLUMN role ENUM('citizen', 'police') DEFAULT 'citizen'`);
    console.log('Altered successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
