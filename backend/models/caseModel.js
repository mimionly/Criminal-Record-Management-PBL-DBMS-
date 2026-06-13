const pool = require('../config/db');

/**
 * Creates a new case docket linked to an FIR.
 * Also transitions the FIR status to 'Under Review'.
 * @param {Object} details
 * @param {number} details.firId
 * @param {number} details.officerId
 * @param {number|null} details.criminalId
 * @param {string|null} details.remarks
 * @returns {Promise<number>} Inserted Case ID.
 */
const createCase = async ({ firId, officerId, criminalId, remarks }) => {
  // Check if case already exists for this FIR
  const [existing] = await pool.query('SELECT id FROM cases WHERE fir_id = ?', [firId]);
  if (existing.length > 0) {
    throw new Error('A case docket already exists for this FIR.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO cases (fir_id, officer_id, criminal_id, remarks, status) VALUES (?, ?, ?, ?, ?)',
      [firId, officerId, criminalId || null, remarks || null, 'Active']
    );

    // Update the corresponding FIR status to 'Under Review'
    await connection.query(
      "UPDATE firs SET status = 'Under Review' WHERE id = ?",
      [firId]
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Retrieves all cases in the system with linked FIR, Officer, and Criminal details.
 * @returns {Promise<Array>} Array of cases.
 */
const getAllCases = async () => {
  const [rows] = await pool.query(
    `SELECT c.id, c.fir_id, c.criminal_id, c.officer_id, c.status, c.remarks, c.created_at,
            f.title AS fir_title, f.description AS fir_description, f.location AS fir_location, f.crime_type AS fir_crime_type,
            o.name AS officer_name, o.badge_number AS officer_badge,
            cr.name AS criminal_name
     FROM cases c
     JOIN firs f ON c.fir_id = f.id
     LEFT JOIN officers o ON c.officer_id = o.id
     LEFT JOIN criminals cr ON c.criminal_id = cr.id
     ORDER BY c.created_at DESC`
  );
  return rows;
};

module.exports = {
  createCase,
  getAllCases
};
