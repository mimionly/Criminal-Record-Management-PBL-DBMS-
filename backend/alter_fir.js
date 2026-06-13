require('dotenv').config();
const db = require('./config/db');

async function run() {
  try {
    console.log('Altering database tables...');
    
    // 1. Add phone column to users table
    try {
      await db.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL DEFAULT NULL`);
      console.log('Added phone column to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('phone column already exists in users table.');
      } else {
        throw e;
      }
    }

    // 2. Add priority and investigation_notes to firs table
    try {
      await db.query(`ALTER TABLE firs ADD COLUMN priority ENUM('Low', 'Medium', 'High', 'Emergency') DEFAULT 'Low'`);
      console.log('Added priority column to firs table.');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('priority column already exists in firs table.');
      } else {
        throw e;
      }
    }

    try {
      await db.query(`ALTER TABLE firs ADD COLUMN investigation_notes TEXT NULL DEFAULT NULL`);
      console.log('Added investigation_notes column to firs table.');
    } catch (e) {
      if (e.code === 'ER_DUP_COLUMN_NAME') {
        console.log('investigation_notes column already exists in firs table.');
      } else {
        throw e;
      }
    }

    // 3. Create fir_comments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fir_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fir_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fir_id) REFERENCES firs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Created fir_comments table.');

    console.log('Database alterations complete!');
    process.exit(0);
  } catch (err) {
    console.error('Alter failed:', err);
    process.exit(1);
  }
}

run();
