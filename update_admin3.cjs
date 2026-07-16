const fs = require('fs');
let content = fs.readFileSync('src/components/event/AdminTab.tsx', 'utf8');

content = content.replace(
  `                    <td className=\"px-4 py-3\">
                      <div className=\"font-medium text-slate-900\">{m.name}</div>
                      <div className=\"text-xs text-slate-500\">{m.email}</div>
                    </td>
                    <td className=\"px-4 py-3\">
                      <Badge variant=\"neutral\" className=\"text-xs\">{m.role}</Badge>
                    </td>`,
  `                    <td className=\"px-4 py-3\">
                      <div className=\"font-medium text-slate-900\">{m.name}</div>
                      <div className=\"text-xs text-slate-500\">{m.email}</div>
                      {m.rsvpStatus && (
                        <div className=\"mt-1 text-xs\">
                          <span className=\"font-semibold text-slate-600\">RSVP:</span>{' '}
                          <span className={
                            m.rsvpStatus === 'Going' ? 'text-indigo-600' :
                            m.rsvpStatus === 'Maybe' ? 'text-amber-600' :
                            'text-slate-500'
                          }>{m.rsvpStatus}</span>
                        </div>
                      )}
                    </td>
                    <td className=\"px-4 py-3\">
                      <Badge variant=\"neutral\" className=\"text-xs\">{m.role}</Badge>
                    </td>`
);

fs.writeFileSync('src/components/event/AdminTab.tsx', content);
