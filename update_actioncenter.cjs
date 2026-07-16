const fs = require('fs');

let content = fs.readFileSync('src/components/event/ActionCenter.tsx', 'utf8');

if (!content.includes("import { EventStatus }")) {
  content = content.replace("import { Event } from '../../types';", "import { Event } from '../../types';\nimport { EventStatus } from '../../lib/eventStatus';");
}

content = content.replace(/event\.state === 'Draft'/g, "EventStatus.isDraft(event.state)");
content = content.replace(/event\.state === 'In Progress'/g, "EventStatus.isInProgress(event.state)");
content = content.replace(/event\.state === 'Judging'/g, "EventStatus.isJudging(event.state)");

fs.writeFileSync('src/components/event/ActionCenter.tsx', content);
console.log("ActionCenter updated");
