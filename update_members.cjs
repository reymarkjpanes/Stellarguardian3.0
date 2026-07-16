const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  `  const members = db.prepare(\`
    SELECT m.id, m.role, m.status, u.id as userId, u.name, u.email, u.walletAddress
    FROM event_memberships m
    JOIN users u ON m.userId = u.id
    WHERE m.eventId = ?
  \`).all(event.id);`,
  `  const members = db.prepare(\`
    SELECT m.id, m.role, m.status, u.id as userId, u.name, u.email, u.walletAddress,
           (SELECT status FROM rsvps r WHERE r.eventId = m.eventId AND r.userId = m.userId) as rsvpStatus
    FROM event_memberships m
    JOIN users u ON m.userId = u.id
    WHERE m.eventId = ?
  \`).all(event.id);`
);

fs.writeFileSync('server.ts', content);
