const pool = require('../config/db');

/**
 * Retrieves a user by their Clerk ID.
 * @param {string} clerkId - The user's Clerk ID.
 * @returns {Promise<Object|null>} The user object or null if not found.
 */
const getUserByClerkId = async (clerkId) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE clerk_id = ?',
    [clerkId]
  );
  return rows.length > 0 ? rows[0] : null;
};


/**
 * Retrieves a user by their email address.
 * @param {string} email - The user's email.
 * @returns {Promise<Object|null>} The user object or null if not found.
 */
const getUserByEmail = async (email) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, clerk_id FROM users WHERE email = ?',
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Links a Clerk ID to an existing user record.
 * @param {number} userId - The local database user ID.
 * @param {string} clerkId - The Clerk ID to associate.
 * @returns {Promise<void>}
 */
const updateClerkId = async (userId, clerkId) => {
  await pool.query(
    'UPDATE users SET clerk_id = ? WHERE id = ?',
    [clerkId, userId]
  );
};

/**
 * Creates a new user record from a Clerk profile.
 * @param {Object} userDetails - Details of the user to insert.
 * @param {string} userDetails.clerkId - Clerk user ID.
 * @param {string} userDetails.name - User full name.
 * @param {string} userDetails.email - User email.
 * @param {string} userDetails.role - User system role.
 * @returns {Promise<number>} The ID of the newly inserted user.
 */
const createUser = async ({ clerkId, name, email, role }) => {
  const [result] = await pool.query(
    'INSERT INTO users (clerk_id, name, email, role) VALUES (?, ?, ?, ?)',
    [clerkId, name, email, role]
  );
  return result.insertId;
};

/**
 * Updates the role of a user in the local database.
 * @param {number} userId - The local database user ID.
 * @param {string} role - The new role ('citizen' or 'police').
 * @returns {Promise<void>}
 */
const updateUserRole = async (userId, role) => {
  await pool.query(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, userId]
  );
};

/**
 * Retrieves all users with the role 'citizen'.
 * @returns {Promise<Array<Object>>} A list of citizen users.
 */
const getAllCitizens = async () => {
  const [rows] = await pool.query(
    "SELECT id, name, email FROM users WHERE role = 'citizen'"
  );
  return rows;
};

module.exports = {
  getUserByClerkId,
  getUserByEmail,
  updateClerkId,
  createUser,
  updateUserRole,
  getAllCitizens
};
