const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const targetStr = `app.put("/api/events/:id", authenticateToken, (req: any, res) => {
  const { title, description, category, format, visibility, registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tags, rulesPublished, timelineConfirmed } = req.body;`;

const newStr = `app.put("/api/events/:id", authenticateToken, (req: any, res) => {
  const { title, description, category, format, visibility, registrationDeadline, startDate, endDate, prizeTotal, prizeBreakdown, tags, rulesPublished, timelineConfirmed, capacity, teamSizeMax, bannerUrl, contactEmail } = req.body;`;

content = content.replace(targetStr, newStr);

const targetUpdateStr = `  db.prepare(\`
    UPDATE events
    SET title = ?, description = ?, category = ?, format = ?, visibility = ?,
        registrationDeadline = ?, startDate = ?, endDate = ?,
        prizeTotal = ?, prizeBreakdown = ?, tags = ?,
        rulesPublished = ?, timelineConfirmed = ?
    WHERE id = ?
  \`).run(
    title ?? event.title, description ?? event.description, category ?? event.category, format ?? event.format, visibility ?? event.visibility,
    registrationDeadline ?? event.registrationDeadline, startDate ?? event.startDate, endDate ?? event.endDate,
    newPrizeTotal, newPrizeBreakdown, tagsStr ?? event.tags,
    rulesPublished !== undefined ? (rulesPublished ? 1 : 0) : event.rulesPublished,
    timelineConfirmed !== undefined ? (timelineConfirmed ? 1 : 0) : event.timelineConfirmed,
    req.params.id
  );`;

const newUpdateStr = `  db.prepare(\`
    UPDATE events
    SET title = ?, description = ?, category = ?, format = ?, visibility = ?,
        registrationDeadline = ?, startDate = ?, endDate = ?,
        prizeTotal = ?, prizeBreakdown = ?, tags = ?,
        rulesPublished = ?, timelineConfirmed = ?,
        capacity = ?, teamSizeMax = ?, bannerUrl = ?, contactEmail = ?
    WHERE id = ?
  \`).run(
    title ?? event.title, description ?? event.description, category ?? event.category, format ?? event.format, visibility ?? event.visibility,
    registrationDeadline ?? event.registrationDeadline, startDate ?? event.startDate, endDate ?? event.endDate,
    newPrizeTotal, newPrizeBreakdown, tagsStr ?? event.tags,
    rulesPublished !== undefined ? (rulesPublished ? 1 : 0) : event.rulesPublished,
    timelineConfirmed !== undefined ? (timelineConfirmed ? 1 : 0) : event.timelineConfirmed,
    capacity !== undefined ? capacity : event.capacity,
    teamSizeMax !== undefined ? teamSizeMax : event.teamSizeMax,
    bannerUrl !== undefined ? bannerUrl : event.bannerUrl,
    contactEmail !== undefined ? contactEmail : event.contactEmail,
    req.params.id
  );`;

content = content.replace(targetUpdateStr, newUpdateStr);

fs.writeFileSync('server.ts', content);
console.log("PUT Event Updated");
