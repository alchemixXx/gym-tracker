import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://gym:gym_password@localhost:5433/gym_tracker',
});
