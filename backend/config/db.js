const mysql = require('mysql2/promise');

// Create connection pool configured using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cipms_db',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test helper to verify configuration during bootstrap
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Database pool connected successfully!');
    connection.release();
  } catch (error) {
    console.error('Database connection failed... Verify MySQL configurations:');
    console.error(error.message);
  }
};

testConnection();

module.exports = pool;
