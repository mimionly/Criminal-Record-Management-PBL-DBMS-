const pool = require('../config/db');

/**
 * Retrieves all challans linked to a specific user.
 * @param {number} userId - The user ID.
 * @returns {Promise<Array>}
 */
const getChallansByUserId = async (userId) => {
  const [rows] = await pool.query(
    'SELECT id, user_id, vehicle_no, reason, amount, status, issue_date FROM challans WHERE user_id = ? ORDER BY issue_date DESC',
    [userId]
  );
  return rows;
};

/**
 * Retrieves all challans in the system.
 * @returns {Promise<Array>}
 */
const getAllChallans = async () => {
  const [rows] = await pool.query(
    `SELECT c.id, c.user_id, c.vehicle_no, c.reason, c.amount, c.status, c.issue_date, u.name AS user_name 
     FROM challans c
     LEFT JOIN users u ON c.user_id = u.id
     ORDER BY c.issue_date DESC`
  );
  return rows;
};

/**
 * Creates a new traffic challan.
 * @param {Object} details
 * @returns {Promise<number>} Inserted ID.
 */
const createChallan = async ({ userId, vehicleNo, reason, amount, status }) => {
  const [result] = await pool.query(
    'INSERT INTO challans (user_id, vehicle_no, reason, amount, status) VALUES (?, ?, ?, ?, ?)',
    [userId || null, vehicleNo, reason || 'Traffic Violation', amount, status || 'Unpaid']
  );
  return result.insertId;
};

/**
 * Updates status of a challan.
 * @param {number} challanId
 * @param {string} status
 * @returns {Promise<void>}
 */
const updateChallanStatus = async (challanId, status) => {
  await pool.query(
    'UPDATE challans SET status = ? WHERE id = ?',
    [status, challanId]
  );
};

module.exports = {
  getChallansByUserId,
  getAllChallans,
  createChallan,
  updateChallanStatus
};
