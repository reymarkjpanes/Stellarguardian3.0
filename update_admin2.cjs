const fs = require('fs');
let content = fs.readFileSync('src/components/event/AdminTab.tsx', 'utf8');

const rsvpStatsSection = `
      <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">
        <div className=\"bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex justify-between items-center\">
          <span className=\"text-indigo-800 font-semibold\">Going (RSVP)</span>
          <span className=\"text-2xl font-black text-indigo-900\">{event.stats?.rsvps?.going || 0}</span>
        </div>
        <div className=\"bg-amber-50 border border-amber-100 p-4 rounded-xl flex justify-between items-center\">
          <span className=\"text-amber-800 font-semibold\">Maybe (RSVP)</span>
          <span className=\"text-2xl font-black text-amber-900\">{event.stats?.rsvps?.maybe || 0}</span>
        </div>
        <div className=\"bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center\">
          <span className=\"text-slate-600 font-semibold\">Not Going (RSVP)</span>
          <span className=\"text-2xl font-black text-slate-900\">{event.stats?.rsvps?.notGoing || 0}</span>
        </div>
      </div>
`;

content = content.replace(
  `        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Submissions</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.submissions?.length || 0}</p>
        </div>
      </div>`,
  `        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Submissions</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.submissions?.length || 0}</p>
        </div>
      </div>\n` + rsvpStatsSection
);

fs.writeFileSync('src/components/event/AdminTab.tsx', content);
