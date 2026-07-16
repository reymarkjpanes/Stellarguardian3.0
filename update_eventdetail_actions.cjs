const fs = require('fs');
let content = fs.readFileSync('src/pages/EventDetail.tsx', 'utf8');

// Replace import { EventStatus } with import { EventStatus, isActionAllowed }
content = content.replace("import { EventStatus } from '../lib/eventStatus';", "import { EventStatus, isActionAllowed } from '../lib/eventStatus';");

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
content = content.replace("EventStatus.isRegistrationOpen(event.state)", "isActionAllowed(event.state, 'close_registration')"); // Wait, previously it was EventStatus.isRegistrationOpen(event.state) && <Button onClick={() => handleStateChange('Registration Closed')}>Close Registration</Button>
content = content.replace("EventStatus.canStartEvent(event.state)", "isActionAllowed(event.state, 'start_event')");
content = content.replace("EventStatus.canBeginJudging(event.state)", "isActionAllowed(event.state, 'begin_judging')");
content = content.replace("EventStatus.canComplete(event.state)", "isActionAllowed(event.state, 'complete')");

// We need to fix the case where isRegistrationOpen was used for participant's check
// But wait, my script just replaced EventStatus.isRegistrationOpen(event.state) to isActionAllowed(event.state, 'close_registration') globally which might be wrong!
// Wait! Let's just do it manually with edit_file.
