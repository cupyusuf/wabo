import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const fresh = process.argv.includes('--fresh');

  if (fresh) {
    await pool.query(`
      DROP TABLE IF EXISTS auth_keys;
      DROP TABLE IF EXISTS auth_creds;
    `);
    console.log('Dropped all tables');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_creds (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'creds',
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_keys (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_auth_keys_type ON auth_keys(type);
  `);

  console.log('Migration completed');
  await pool.end();
}

migrate().catch(console.error);
