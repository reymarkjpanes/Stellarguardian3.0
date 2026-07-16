const fs = require('fs');
let content = fs.readFileSync('src/components/event/SubmissionsTab.tsx', 'utf8');

content = content.replace(
  `                <p className=\"text-xs text-slate-500 mb-2\">By: {sub.submitterName}</p>
                <a href={sub.url} target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-indigo-600 text-sm hover:underline flex items-center gap-1 mb-3\">
                  <LinkIcon className=\"w-3 h-3\" /> View Project
                </a>
                <p className=\"text-sm text-slate-600 line-clamp-3\">{sub.description}</p>`,
  `                <p className=\"text-xs text-slate-500 mb-2\">By: {sub.submitterName}</p>
                <a href={sub.url} target=\"_blank\" rel=\"noopener noreferrer\" className=\"text-indigo-600 text-sm hover:underline flex items-center gap-1 mb-3\">
                  <LinkIcon className=\"w-3 h-3\" /> View Project
                </a>
                <p className=\"text-sm text-slate-600 line-clamp-3 mb-3\">{sub.description}</p>
                {(isJudging || isCompleted) && sub.evaluationCount !== undefined && (
                  <div className=\"flex items-center gap-3 pt-3 border-t border-slate-100\">
                    <div className=\"flex flex-col\">
                      <span className=\"text-[10px] uppercase font-bold text-slate-400 tracking-wider\">Evaluations</span>
                      <span className=\"text-sm font-semibold text-slate-700\">{sub.evaluationCount}</span>
                    </div>
                    {sub.evaluationCount > 0 && sub.averageScore !== undefined && (
                      <div className=\"flex flex-col\">
                        <span className=\"text-[10px] uppercase font-bold text-slate-400 tracking-wider\">Avg Score</span>
                        <span className=\"text-sm font-semibold text-amber-600\">{Number(sub.averageScore).toFixed(1)} / 100</span>
                      </div>
                    )}
                  </div>
                )}`
);

fs.writeFileSync('src/components/event/SubmissionsTab.tsx', content);
