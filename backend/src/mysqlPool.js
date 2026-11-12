const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

let pool;

const isEnabled = () => String(process.env.MYSQL_ENABLED || '').trim().toLowerCase() === 'true';

const getPool = () => {
    if (!isEnabled()) {
        throw new Error('MySQL is not enabled for this backend. Set MYSQL_ENABLED=true only after local setup is ready.');
    }

    const required = ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'];
    const missing = required.filter(name => !String(process.env[name] || '').trim());
    if (missing.length) throw new Error(`Missing MySQL settings: ${missing.join(', ')}`);

    if (!pool) {
        const sslEnabled = String(process.env.MYSQL_SSL || '').trim().toLowerCase() === 'true';
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST.trim(),
            port: Number(process.env.MYSQL_PORT || 3306),
            database: process.env.MYSQL_DATABASE.trim(),
            user: process.env.MYSQL_USER.trim(),
            password: process.env.MYSQL_PASSWORD,
            ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
            waitForConnections: true,
            connectionLimit: Math.max(1, Number(process.env.MYSQL_POOL_SIZE) || 8),
            queueLimit: 0,
            connectTimeout: 10000,
            enableKeepAlive: true,
            timezone: 'Z',
            charset: 'utf8mb4',
            supportBigNumbers: true,
            bigNumberStrings: true,
            decimalNumbers: false,
        });
    }

    return pool;
};

const query = (sql, values = []) => getPool().execute(sql, values);

const ping = async () => {
    const [rows] = await getPool().execute('SELECT 1 AS ok');
    return Number(rows[0]?.ok) === 1;
};

const withTransaction = async callback => {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            error.rollbackError = rollbackError;
        }
        throw error;
    } finally {
        connection.release();
    }
};

const close = async () => {
    if (!pool) return;
    const currentPool = pool;
    pool = undefined;
    await currentPool.end();
};

module.exports = { close, getPool, isEnabled, ping, query, withTransaction };
