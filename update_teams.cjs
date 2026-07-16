const fs = require('fs');
let content = fs.readFileSync('src/components/event/TeamsTab.tsx', 'utf8');

content = content.replace(
  `                <div>
                  <h4 className=\"font-bold text-slate-900\">{team.name}</h4>
                  <p className=\"text-xs text-slate-500\">Created {new Date(team.createdAt).toLocaleDateString()}</p>
                </div>`,
  `                <div className=\"w-full\">
                  <div className=\"flex justify-between items-center mb-2\">
                    <h4 className=\"font-bold text-slate-900\">{team.name}</h4>
                    <p className=\"text-xs text-slate-500\">{new Date(team.createdAt).toLocaleDateString()}</p>
                  </div>
                  {(team as any).members && (team as any).members.length > 0 && (
                    <div className=\"mt-3 pt-3 border-t border-slate-200/60\">
                      <p className=\"text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider\">Members</p>
                      <ul className=\"space-y-1\">
                        {(team as any).members.map((m: any) => (
                          <li key={m.id} className=\"text-sm text-slate-700 flex items-center gap-2\">
                            <div className=\"w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold\">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>`
);

fs.writeFileSync('src/components/event/TeamsTab.tsx', content);
