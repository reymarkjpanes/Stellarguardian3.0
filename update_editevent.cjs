const fs = require('fs');

let content = fs.readFileSync('src/pages/EditEvent.tsx', 'utf8');

if (!content.includes("import { EventStatus }")) {
  content = content.replace("import { toast } from 'sonner';", "import { toast } from 'sonner';\nimport { EventStatus } from '../lib/eventStatus';");
}

content = content.replace(/formData\.state === 'Draft'/g, "EventStatus.isDraft(formData.state)");

fs.writeFileSync('src/pages/EditEvent.tsx', content);
console.log("EditEvent updated");
