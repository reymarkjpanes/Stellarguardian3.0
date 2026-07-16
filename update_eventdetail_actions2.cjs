const fs = require('fs');
let content = fs.readFileSync('src/pages/EventDetail.tsx', 'utf8');

// Update imports
if (!content.includes('isActionAllowed')) {
  content = content.replace("import { EventStatus } from '../lib/eventStatus';", "import { EventStatus, isActionAllowed } from '../lib/eventStatus';");
}

// Update Edit Configuration button
const targetEditBtn = `<Link to={\`/events/\${event.id}/edit\`}>
                       <Button variant="outline" className="w-full sm:w-auto">Edit Configuration</Button>
                    </Link>`;
const newEditBtn = `{isActionAllowed(event.state, 'edit') && (
                      <Link to={\`/events/\${event.id}/edit\`}>
                         <Button variant="outline" className="w-full sm:w-auto">Edit Configuration</Button>
                      </Link>
                    )}`;
content = content.replace(targetEditBtn, newEditBtn);

// Replace transition buttons
content = content.replace("EventStatus.canFund(event.state)", "isActionAllowed(event.state, 'fund')");
content = content.replace("EventStatus.canPublish(event.state)", "isActionAllowed(event.state, 'publish')");
content = content.replace("EventStatus.canOpenRegistration(event.state)", "isActionAllowed(event.state, 'open_registration')");

content = content.replace("{EventStatus.isRegistrationOpen(event.state) && <Button onClick={() => handleStateChange('Registration Closed')}>Close Registration</Button>}", "{isActionAllowed(event.state, 'close_registration') && <Button onClick={() => handleStateChange('Registration Closed')}>Close Registration</Button>}");

content = content.replace("EventStatus.canStartEvent(event.state)", "isActionAllowed(event.state, 'start_event')");
content = content.replace("EventStatus.canBeginJudging(event.state)", "isActionAllowed(event.state, 'begin_judging')");
content = content.replace("EventStatus.canComplete(event.state)", "isActionAllowed(event.state, 'complete')");

// Also check the participant apply logic
content = content.replace("{!event.myMembership && EventStatus.isRegistrationOpen(event.state) && (", "{!event.myMembership && isActionAllowed(event.state, 'apply') && (");
content = content.replace("{!event.myMembership && !EventStatus.isRegistrationOpen(event.state) && (", "{!event.myMembership && !isActionAllowed(event.state, 'apply') && (");

fs.writeFileSync('src/pages/EventDetail.tsx', content);
console.log("updated");
