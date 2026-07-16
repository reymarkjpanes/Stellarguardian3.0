const fs = require('fs');

let content = fs.readFileSync('src/components/event/GlobalActionCenter.tsx', 'utf8');

if (!content.includes("import { EventStatus }")) {
  content = content.replace("import { AlertCircle, ArrowRight } from 'lucide-react';", "import { AlertCircle, ArrowRight } from 'lucide-react';\nimport { EventStatus } from '../../lib/eventStatus';");
}

content = content.replace(/event\.state === 'Draft'/g, "EventStatus.isDraft(event.state)");
content = content.replace(/event\.state === 'Judging'/g, "EventStatus.isJudging(event.state)");

fs.writeFileSync('src/components/event/GlobalActionCenter.tsx', content);
console.log("GlobalActionCenter updated");
