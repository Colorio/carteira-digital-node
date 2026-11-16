import 'dotenv/config';
import { config } from 'dotenv';
import { Pool } from 'pg';

export default async function setup() {
  config({
    path: '.env.test',
    override: true,
  });

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const clearDatabase = async () => {
    await pool.query(`
      TRUNCATE TABLE
        "WalletEntry",
        "Transaction",
        "Wallet",
        "User"
      CASCADE;
    `);
  };

  await clearDatabase();

  return async () => {
    await clearDatabase();
    await pool.end();
  };
}