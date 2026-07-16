const fs = require('fs');
let content = fs.readFileSync('src/components/event/JudgingTab.tsx', 'utf8');

content = content.replace(
  `                    <div>
                      <h4 className=\"font-bold text-slate-900\">{sub.title}</h4>
                      <p className=\"text-sm text-slate-500\">Avg Score: <strong className=\"text-slate-900\">{avgScore.toFixed(1)}</strong> ({evals.length} ratings)</p>
                    </div>
                  </div>`,
  `                    <div className=\"w-full\">
                      <h4 className=\"font-bold text-slate-900\">{sub.title}</h4>
                      <p className=\"text-sm text-slate-500 mb-3\">Avg Score: <strong className=\"text-slate-900\">{avgScore.toFixed(1)}</strong> ({evals.length} ratings)</p>
                      
                      {evals.length > 0 && (
                        <div className=\"bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 space-y-2\">
                          {evals.map(e => (
                            <div key={e.id} className=\"text-sm flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 pb-2 last:border-0 last:pb-0\">
                              <div className=\"flex items-center gap-2 mb-1 sm:mb-0\">
                                <div className=\"w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs\">
                                  {e.judgeName?.charAt(0).toUpperCase()}
                                </div>
                                <span className=\"font-medium text-slate-700\">{e.judgeName}</span>
                              </div>
                              <div className=\"flex items-center gap-3\">
                                <span className=\"text-amber-600 font-bold\">{e.score}/10</span>
                                {e.feedback && <span className=\"text-slate-500 italic truncate max-w-[200px]\" title={e.feedback}>\"{e.feedback}\"</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>`
);

fs.writeFileSync('src/components/event/JudgingTab.tsx', content);
