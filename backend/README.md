# CIPMS Backend API Server

The server handles application routes, User/Officer/Admin authentication, and real-time distress beacon broadcasts via WebSockets.

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and configure your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Database Setup**:
   Ensure you have a local instance of MySQL running, and verify the database matching `DB_NAME` is initialized. You can build the default schemas using the SQL script located in the parent directory:
   `../database/schema.sql`.

4. **Run Server**:
   - **Development (Automatic reloading via nodemon)**:
     ```bash
     npm run dev
     ```
   - **Production Mode**:
     ```bash
     npm start
     ```
