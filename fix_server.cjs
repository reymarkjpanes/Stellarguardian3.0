const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\("\/api\/events", authenticateToken, \(req: any, res\) => \{([\s\S]*?)const stmt = db\.prepare\("INSERT INTO events \((.*?)\) VALUES \((.*?)\)"\);/m;

const match = content.match(regex);
if (match) {
    const origFields = match[1];
    
    const newFields = `
  const { 
    title, description, category, format, visibility, 
    registrationDeadline, startDate, endDate, 
    prizeTotal, prizeBreakdown, tags,
    capacity, teamSizeMax, bannerUrl, contactEmail
  } = req.body;
  const eventId = req.params.id;
`;
    
    content = content.replace(regex, `app.post("/api/events", authenticateToken, (req: any, res) => {${newFields}  const stmt = db.prepare("INSERT INTO events (hostUserId, title, description, category, format, visibility, registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tags, capacity, teamSizeMax, bannerUrl, contactEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");`);
    
    // Also need to update stmt.run arguments
    const runRegex = /const info = stmt\.run\((.*?)\);/;
    content = content.replace(runRegex, `const info = stmt.run(req.user.id, title, description, category, format, visibility, registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, JSON.stringify(tags || []), capacity || null, teamSizeMax || 4, bannerUrl || null, contactEmail || null);`);

    fs.writeFileSync('server.ts', content);
    console.log("Server updated successfully");
} else {
    console.log("Regex not matched");
}
