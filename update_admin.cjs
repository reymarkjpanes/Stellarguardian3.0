const fs = require('fs');
let content = fs.readFileSync('src/components/event/AdminTab.tsx', 'utf8');

const statsSection = `
      <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">
        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Participants</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.stats?.participantsCount || 0}</p>
        </div>
        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Judges</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.stats?.judgesCount || 0}</p>
        </div>
        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Teams</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.teams?.length || 0}</p>
        </div>
        <div className=\"bg-white p-6 border border-slate-200 rounded-xl shadow-sm text-center\">
          <p className=\"text-sm text-slate-500 mb-1\">Submissions</p>
          <p className=\"text-3xl font-black text-slate-900\">{event.submissions?.length || 0}</p>
        </div>
      </div>
`;

content = content.replace(
  `    <div className=\"space-y-8\">
      {/* Edit Event Action */}`,
  `    <div className=\"space-y-8\">\n` + statsSection + `\n      {/* Edit Event Action */}`
);

fs.writeFileSync('src/components/event/AdminTab.tsx', content);
