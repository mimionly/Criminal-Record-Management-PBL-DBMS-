# 🚔 Criminal Intelligence & Public Safety Management System (CIPMS)

CIPMS is an enterprise-grade, data-driven platform designed to modernize public safety, streamline police operations, and enhance citizen-police collaboration. This system integrates real-time communications, digital mapping, automated dispatch, and payment services to deliver a robust public safety workspace.

---

## 🛠️ Technologies & Services Used

The application is decoupled into a high-performance backend API and a responsive frontend client:

### 1. Frontend Portal
- **Framework**: **React.js (v18+)** with **TypeScript** for compile-time safety and type enforcement.
- **Build System**: **Vite** for fast, modular development and asset optimization.
- **Styling**: **Tailwind CSS** for modern UI design, layouts, and responsiveness.
- **Maps Engine**: **Leaflet.js** & **React Leaflet** utilizing OpenStreetMap tiles to render coordinate markers for emergency SOS and crime spots.
- **Charts & KPIs**: **Recharts** to display category counts and analytics on police metrics.
- **Icons**: **Lucide React** for UI visuals.
- **Authentication**: **Clerk React SDK** for secure, passwordless authentication using Google OAuth.

### 2. Backend API Server
- **Runtime**: **Node.js** with **Express.js** for RESTful API routing and middleware pipelines.
- **Real-Time WebSockets**: **Socket.io** for live bidirectional event broadcasting (e.g., instant case status alerts and SOS dispatches).
- **SMS Gateway**: **Twilio REST API** (integrated via standard HTTPS modules) to send text messages to citizens when police actions are taken on their cases.
- **File Uploader**: **Multer** to handle digital evidence attachments (images, PDFs, screenshots) uploaded by citizens.

### 3. Database Layer
- **Relational Engine**: **MySQL** for transactional safety (ACID compliance) and query performance.
- **Queries**: Standard parameterized SQL queries via **mysql2/promise** connection pools to eliminate SQL injection vulnerabilities.

### 4. Containers & Production Web Servers
- **Docker** & **Docker Compose**: Containerization layers packaging the database, API, and client portals.
- **Nginx**: Production reverse proxy server hosting the compiled frontend assets and forwarding `/api` calls.

---

## 🌟 Core Feature Workflows

### 👮 1. Police FIR Investigation Workspace
- **Ledger List View**: Police can inspect all incoming complaints in a clean ledger table.
- **Dual Column Workspace**: Clicking a complaint row opens a single-screen dashboard workspace:
  - **Citizen Contacts & Details**: Full information of the complainant.
  - **Incident Narrative**: The detailed description filed.
  - **Evidence Viewer**: Allows police to view and download citizen-uploaded photos/documents.
  - **Correspondence Feed**: A live chat feed between the citizen and investigating officers.
  - **Case Controls**: Live dropdowns to alter priority levels, assign officers, and link suspect criminal histories.
  - **Visual Timeline**: A chronological timeline tracking the case from submission to closure.

### 💳 2. Traffic Fine Payments
- **Issuing Fines**: Police can issue traffic challans to a vehicle registration number with a specific violation reason (e.g., "Illegal Parking") and optionally link a citizen driver.
- **Citizen Fines Tab**: Citizens can inspect active and paid fines issued to their vehicle or user profile.
- **Simulated Payment Gateway**: Clicking "Pay Fine" opens a secure overlay credit card portal. Inputs format automatically (e.g., card spacing, expiry slash), loading spinners simulate transaction delay, and database records update to "Paid" upon completion.
- **Clearance Receipts**: Paid fines provide an instant option to download a plain-text transaction receipt for verification.

### 🔔 3. Twilio SMS & Real-Time Alerts
- **WebSocket Broadcast**: Case status updates trigger live modal notification alerts in the Citizen Dashboard.
- **Twilio SMS Alerts**: If a citizen has their phone number registered in the database, changing case status to resolved/underway automatically fires a background Twilio SMS dispatch notifying them of the update.

---

## 📂 Database Schema (MySQL)

```sql
-- 1. Users Table (Auth Profile Profiles)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clerk_id VARCHAR(255) UNIQUE NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NULL DEFAULT NULL,
    role ENUM('citizen', 'police', 'inspector', 'admin') DEFAULT 'citizen',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Officers Table (Roster Records)
CREATE TABLE officers (
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

-- 3. FIRs Table (Complainant Statements)
CREATE TABLE firs (
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
    priority ENUM('Low', 'Medium', 'High', 'Emergency') DEFAULT 'Low',
    investigation_notes TEXT NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Challans Table (Traffic violations and tracking)
CREATE TABLE challans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    vehicle_no VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NOT NULL DEFAULT 'Traffic Violation',
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Unpaid', 'Paid') DEFAULT 'Unpaid',
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## 🚀 Local Run Guide

### 1. Database Initialization
1. Ensure your local MySQL server is running.
2. Log in and execute the schema:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cipms_db;"
   mysql -u root -p cipms_db < database/schema.sql
   ```

### 2. Backend Setup (`/backend`)
1. Create a `.env` file in the `backend/` directory:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=cipms_db
   PORT=5000

   # Clerk Auth Credentials
   CLERK_SECRET_KEY=sk_test_...
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_WEBHOOK_URL=whsec_...

   # Twilio Credentials
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_MESSAGING_SERVICE_SID=MG...
   ```
2. Open terminal and run:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### 3. Frontend Setup (`/frontend`)
1. Open a separate terminal and run:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## 🐳 Containerized Deployment (Docker)

To run the entire database, backend, and frontend stack inside isolated containers:

1. Create a `.env` file in the **root** folder of the repository.
2. Execute the commands:
   ```bash
   docker-compose build
   docker-compose up -d
   ```
3. Open your browser at **[http://localhost](http://localhost)** to view the app.

---

## ☁️ Cloud Deployments

### A. Deploying to Clever Cloud (Monorepo Setup)
1. Add your SSH public key to your **Clever Cloud Profile**.
2. Add the Clever Cloud Git remote to your local repository:
   ```bash
   git remote add clever git+ssh://git@push-...
   ```
3. Create **two** applications on Clever Cloud:
   - **Backend Web Service**: Add environment variable **`APP_FOLDER`** = **`backend`** and your `.env` variables.
   - **Frontend Static App**: Add environment variable **`APP_FOLDER`** = **`frontend`**.
4. Push your local `main` branch to the remote repository:
   ```bash
   git push clever main:master
   ```

### B. Deploying to Render
- **Backend Service (Web Service)**: Link Git, set **Root Directory** to `backend`, **Build Command** to `npm install`, **Start Command** to `node server.js`, and add env secrets.
- **Frontend Service (Static Site)**: Link Git, set **Root Directory** to `frontend`, **Build Command** to `npm install && npm run build`, and **Publish Directory** to `dist`.
- **API Rewrites**: Under the Frontend Static Site dashboard, add a **Redirects/Rewrites** rule mapping source `/api/*` to rewrite destination `https://your-backend.onrender.com/api/*` (status `200`).

DBMS PBL 
