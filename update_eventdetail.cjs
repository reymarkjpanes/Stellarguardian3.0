const fs = require('fs');

let content = fs.readFileSync('src/pages/EventDetail.tsx', 'utf8');

if (!content.includes("import { EventStatus }")) {
  content = content.replace("import { Event } from '../types';", "import { Event } from '../types';\nimport { EventStatus } from '../lib/eventStatus';");
}

content = content.replace(/event\.state === 'Draft'/g, "EventStatus.canFund(event.state)");
content = content.replace(/event\.state === 'Funded'/g, "EventStatus.canPublish(event.state)");
content = content.replace(/event\.state === 'Published'/g, "EventStatus.canOpenRegistration(event.state)");
content = content.replace(/event\.state === 'Registration Open'/g, "EventStatus.isRegistrationOpen(event.state)");
content = content.replace(/event\.state !== 'Registration Open'/g, "!EventStatus.isRegistrationOpen(event.state)");
content = content.replace(/event\.state === 'Registration Closed'/g, "EventStatus.canStartEvent(event.state)");
content = content.replace(/event\.state === 'In Progress'/g, "EventStatus.canBeginJudging(event.state)");
content = content.replace(/event\.state === 'Judging'/g, "EventStatus.canComplete(event.state)");

fs.writeFileSync('src/pages/EventDetail.tsx', content);
console.log("EventDetail updated");
