const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  `  const winners = db.prepare(\`
    SELECT w.*, s.title as submissionTitle, s.url as submissionUrl, t.name as teamName, u.name as submitterName
    FROM winners w
    JOIN submissions s ON w.submissionId = s.id
    LEFT JOIN teams t ON s.teamId = t.id
    LEFT JOIN users u ON s.userId = u.id
    WHERE w.eventId = ?
    ORDER BY w.rank ASC
  \`).all(event.id);`,
  `  const winners = db.prepare(\`
    SELECT w.*, s.title as submissionTitle, s.url as submissionUrl, t.name as teamName, u.name as submitterName
    FROM winners w
    JOIN submissions s ON w.submissionId = s.id
    LEFT JOIN teams t ON s.teamId = t.id
    LEFT JOIN users u ON s.userId = u.id
    WHERE w.eventId = ?
    ORDER BY w.rank ASC
  \`).all(event.id);
  
  const rsvps = db.prepare(\`
    SELECT r.status, u.name, u.email
    FROM rsvps r
    JOIN users u ON r.userId = u.id
    WHERE r.eventId = ?
  \`).all(event.id);
  
  const rsvpStats = {
    going: rsvps.filter((r: any) => r.status === 'Going').length,
    maybe: rsvps.filter((r: any) => r.status === 'Maybe').length,
    notGoing: rsvps.filter((r: any) => r.status === 'Not Going').length
  };`
);

content = content.replace(
  "    stats: { judgesCount: judges.count, participantsCount: participants.count },",
  "    stats: { judgesCount: judges.count, participantsCount: participants.count, rsvps: rsvpStats },"
);

fs.writeFileSync('server.ts', content);
