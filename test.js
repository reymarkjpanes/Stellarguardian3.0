const sqlite3 = require('better-sqlite3');
const db = new sqlite3('app.db');
const teams = db.prepare(`
    SELECT t.*, 
    (SELECT json_group_array(json_object('id', u.id, 'name', u.name)) 
     FROM team_members tm JOIN users u ON tm.userId = u.id WHERE tm.teamId = t.id) as members
    FROM teams t WHERE t.eventId = ?
`).all(1);
console.log(teams);
