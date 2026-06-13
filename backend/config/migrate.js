const fs = require('fs');
const path = require('path');
const db = require('./db');

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found at:', schemaPath);
      return;
    }

    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Clean comments line-by-line first
    const cleanSql = sqlContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('--'))
      .join('\n');

    // Split SQL by semicolons to execute statements individually
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement.toUpperCase().startsWith('CREATE DATABASE') || statement.toUpperCase().startsWith('USE ')) {
        continue;
      }
      await db.query(statement);
    }
    
    console.log('Database migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

module.exports = runMigrations;
