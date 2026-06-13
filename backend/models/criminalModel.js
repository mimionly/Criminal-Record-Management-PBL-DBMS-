const pool = require('../config/db');

/**
 * Creates a new criminal record and links it to an FIR.
 * @param {Object} details
 * @param {string} details.name
 * @param {number} details.age
 * @param {string} details.crimeType
 * @param {number} details.firId
 * @returns {Promise<number>} The inserted criminal's ID.
 */
const createCriminal = async ({ name, age, crimeType, firId }) => {
  const [result] = await pool.query(
    'INSERT INTO criminals (name, age, crime_type, fir_id) VALUES (?, ?, ?, ?)',
    [name, age, crimeType, firId]
  );
  return result.insertId;
};

/**
 * Retrieves all criminal records linked to their parent FIR.
 * @returns {Promise<Array>} Array of criminals.
 */
const getAllCriminals = async () => {
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.age, c.crime_type, c.fir_id, f.title AS fir_title 
     FROM criminals c 
     JOIN firs f ON c.fir_id = f.id 
     ORDER BY c.created_at DESC`
  );
  return rows;
};

const updateCriminal = async (id, { name, age, crimeType, firId }) => {
  await pool.query(
    'UPDATE criminals SET name = ?, age = ?, crime_type = ?, fir_id = ? WHERE id = ?',
    [name, age, crimeType, firId, id]
  );
};

module.exports = {
  createCriminal,
  getAllCriminals,
  updateCriminal
};
