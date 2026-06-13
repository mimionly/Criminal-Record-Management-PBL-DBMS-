const pool = require('../config/db');

/**
 * Creates a new emergency request entry in MySQL.
 * @param {Object} details
 * @returns {Promise<number>} Inserted ID.
 */
const createEmergencyRequest = async ({ userId, latitude, longitude, requestType }) => {
  const [result] = await pool.query(
    'INSERT INTO emergency_requests (user_id, latitude, longitude, request_type, status) VALUES (?, ?, ?, ?, ?)',
    [userId || null, latitude, longitude, requestType || 'SOS Distress', 'Active']
  );
  return result.insertId;
};

/**
 * Retrieves all emergency requests logged.
 * @returns {Promise<Array>}
 */
const getAllEmergencyRequests = async () => {
  const [rows] = await pool.query(
    `SELECT er.id, er.user_id, er.latitude, er.longitude, er.request_type, er.status, er.created_at, u.name AS user_name
     FROM emergency_requests er
     LEFT JOIN users u ON er.user_id = u.id
     ORDER BY er.created_at DESC`
  );
  return rows;
};

/**
 * Updates status of an emergency request (Active, Dispatched, Resolved).
 * @param {number} requestId
 * @param {string} status
 * @returns {Promise<void>}
 */
const updateEmergencyStatus = async (requestId, status) => {
  await pool.query(
    'UPDATE emergency_requests SET status = ? WHERE id = ?',
    [status, requestId]
  );
};

module.exports = {
  createEmergencyRequest,
  getAllEmergencyRequests,
  updateEmergencyStatus
};
