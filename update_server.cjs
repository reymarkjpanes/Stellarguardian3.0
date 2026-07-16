const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Update teams query
content = content.replace(
  "const teams = db.prepare(`SELECT * FROM teams WHERE eventId = ?`).all(event.id);",
  "const teams = db.prepare(`\n    SELECT t.*, \n    (SELECT json_group_array(json_object('id', u.id, 'name', u.name)) \n     FROM team_members tm JOIN users u ON tm.userId = u.id WHERE tm.teamId = t.id) as membersStr\n    FROM teams t WHERE eventId = ?\n  `).all(event.id).map((t: any) => ({ ...t, members: t.membersStr ? JSON.parse(t.membersStr) : [] }));"
);

// We should also update POST /api/events/:id/teams to add the creator to team_members
content = content.replace(
  "db.prepare(`INSERT INTO teams (eventId, name) VALUES (?, ?)`).run(req.params.id, name);",
  "const info = db.prepare(`INSERT INTO teams (eventId, name) VALUES (?, ?)`).run(req.params.id, name);\n  db.prepare(`INSERT INTO team_members (teamId, userId) VALUES (?, ?)`).run(info.lastInsertRowid, req.user.id);"
);

// Let's update submissions to get the evaluations score sum or count
content = content.replace(
  "const submissions = db.prepare(`\n    SELECT s.*, u.name as submitterName, t.name as teamName \n    FROM submissions s\n    JOIN users u ON s.userId = u.id\n    LEFT JOIN teams t ON s.teamId = t.id\n    WHERE s.eventId = ?\n  `).all(event.id);",
  "const submissions = db.prepare(`\n    SELECT s.*, u.name as submitterName, t.name as teamName,\n    (SELECT COUNT(*) FROM evaluations e WHERE e.submissionId = s.id) as evaluationCount,\n    (SELECT AVG(score) FROM evaluations e WHERE e.submissionId = s.id) as averageScore\n    FROM submissions s\n    JOIN users u ON s.userId = u.id\n    LEFT JOIN teams t ON s.teamId = t.id\n    WHERE s.eventId = ?\n  `).all(event.id);"
);

fs.writeFileSync('server.ts', content);
