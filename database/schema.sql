CREATE DATABASE IF NOT EXISTS cipms_db;
USE cipms_db;

-- 1. Users Table (Base Account Structure)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clerk_id VARCHAR(255) UNIQUE NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
   
    role ENUM('citizen', 'police', 'inspector', 'admin') DEFAULT 'citizen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Officers Table (Links to Users)
CREATE TABLE IF NOT EXISTS officers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    badge_number VARCHAR(50) UNIQUE NOT NULL,
    station VARCHAR(100) NOT NULL,
    `rank` VARCHAR(50) NOT NULL,
    status ENUM('On Patrol', 'Available', 'On Leave') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. FIRs Table
CREATE TABLE IF NOT EXISTS firs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    citizen_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    crime_type VARCHAR(100) NOT NULL,
    status ENUM('Submitted', 'Pending Review', 'Under Review', 'Verified', 'Investigation Started', 'Resolved', 'Rejected') DEFAULT 'Submitted',
    remarks TEXT NULL,
    accused_name VARCHAR(255) NULL,
    evidence_url VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Criminals Table
CREATE TABLE IF NOT EXISTS criminals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    crime_type VARCHAR(100) NOT NULL,
    fir_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fir_id) REFERENCES firs(id) ON DELETE CASCADE
);

-- 5. Cases Table (Intersection of FIR, Officer, and Criminals)
CREATE TABLE IF NOT EXISTS cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fir_id INT UNIQUE NOT NULL,
    criminal_id INT DEFAULT NULL,
    officer_id INT DEFAULT NULL,
    status ENUM('Active', 'Under Investigation', 'Solved', 'Cold Case') DEFAULT 'Active',
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fir_id) REFERENCES firs(id) ON DELETE CASCADE,
    FOREIGN KEY (criminal_id) REFERENCES criminals(id) ON DELETE SET NULL,
    FOREIGN KEY (officer_id) REFERENCES officers(id) ON DELETE SET NULL
);

-- 6. Challans Table (Traffic violations and tracking)
CREATE TABLE IF NOT EXISTS challans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    vehicle_no VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Unpaid', 'Paid') DEFAULT 'Unpaid',
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Emergency Requests (Distress beacons)
CREATE TABLE IF NOT EXISTS emergency_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    request_type VARCHAR(100) NOT NULL,
    status ENUM('Active', 'Dispatched', 'Resolved') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);