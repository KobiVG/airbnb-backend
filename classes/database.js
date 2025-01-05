const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        // Create a connection pool (instead of a single connection)
        this.pool = mysql.createPool({
            host: process.env.db_host,
            user: process.env.db_user,
            password: process.env.db_pass,
            database: process.env.db_name,
            port: process.env.db_port,
            waitForConnections: true,
            connectionLimit: 10, // Max 10 concurrent connections
        });
    }

    // Execute a query using the pool
    async getQuery(sql, params) {
        const [rows] = await this.pool.execute(sql, params);
        return rows;
    }

    // Optionally, you can add a method to close the pool when the application is shutting down
    async closePool() {
        await this.pool.end();
    }
}

module.exports = Database;
