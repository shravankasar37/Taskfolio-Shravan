import pg from 'pg';

// Return DATE columns (due_date) as plain 'YYYY-MM-DD' text instead of a JS Date,
// so the date never shifts because of time zones.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
