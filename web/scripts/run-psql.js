require('dotenv').config({path: '.env.local'});
const cp = require('child_process');
const query = `SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE c.conname = 'events_state_check';`;
const out = cp.execSync(`psql "${process.env.POSTGRES_URL}" -c "${query}"`).toString();
console.log(out);
