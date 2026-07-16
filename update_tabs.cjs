const fs = require('fs');

// SubmissionsTab
let content1 = fs.readFileSync('src/components/event/SubmissionsTab.tsx', 'utf8');
if (!content1.includes("import { EventStatus }")) {
  content1 = content1.replace("import { Event, Submission } from '../../types';", "import { Event, Submission } from '../../types';\nimport { EventStatus } from '../../lib/eventStatus';");
}
content1 = content1.replace(/event\.state === 'In Progress'/g, "EventStatus.isInProgress(event.state)");
content1 = content1.replace(/event\.state === 'Judging'/g, "EventStatus.isJudging(event.state)");
content1 = content1.replace(/event\.state === 'Completed'/g, "EventStatus.isCompleted(event.state)");
fs.writeFileSync('src/components/event/SubmissionsTab.tsx', content1);
console.log("SubmissionsTab updated");

// JudgingTab
let content2 = fs.readFileSync('src/components/event/JudgingTab.tsx', 'utf8');
if (!content2.includes("import { EventStatus }")) {
  content2 = content2.replace("import { Event, Submission } from '../../types';", "import { Event, Submission } from '../../types';\nimport { EventStatus } from '../../lib/eventStatus';");
}
content2 = content2.replace(/event\.state === 'Judging'/g, "EventStatus.isJudging(event.state)");
content2 = content2.replace(/event\.state !== 'Judging' && event\.state !== 'Completed'/g, "!EventStatus.isJudging(event.state) && !EventStatus.isCompleted(event.state)");
content2 = content2.replace(/event\.state === 'Completed'/g, "EventStatus.isCompleted(event.state)");
fs.writeFileSync('src/components/event/JudgingTab.tsx', content2);
console.log("JudgingTab updated");

