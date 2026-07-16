const fs = require('fs');
let content = fs.readFileSync('src/components/event/AdminTab.tsx', 'utf8');

const invitesSection = `
      {/* Sent Invitations */}
      {event.invitations && event.invitations.length > 0 && (
        <div className=\"bg-white p-8 border border-slate-200 rounded-xl shadow-sm\">
          <h3 className=\"text-lg font-bold text-slate-900 mb-6\">Sent Invitations</h3>
          <div className=\"overflow-x-auto\">
            <table className=\"w-full text-sm text-left\">
              <thead className=\"text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200\">
                <tr>
                  <th className=\"px-4 py-3 font-medium\">Email</th>
                  <th className=\"px-4 py-3 font-medium\">Role</th>
                  <th className=\"px-4 py-3 font-medium\">Status</th>
                  <th className=\"px-4 py-3 font-medium\">Expires</th>
                  <th className=\"px-4 py-3 font-medium text-right\">Actions</th>
                </tr>
              </thead>
              <tbody className=\"divide-y divide-slate-100\">
                {event.invitations.map((inv: any) => (
                  <tr key={inv.id} className=\"hover:bg-slate-50/50\">
                    <td className=\"px-4 py-3 font-medium text-slate-900\">{inv.email}</td>
                    <td className=\"px-4 py-3\"><Badge variant=\"neutral\" className=\"text-xs\">{inv.kind}</Badge></td>
                    <td className=\"px-4 py-3\">
                      <Badge variant={inv.status === 'pending' ? 'warning' : 'neutral'} className=\"text-xs capitalize\">{inv.status}</Badge>
                    </td>
                    <td className=\"px-4 py-3 text-slate-500\">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className=\"px-4 py-3 text-right space-x-2\">
                      {inv.status === 'pending' && (
                        <ConfirmDialog
                          title=\"Revoke Invitation\"
                          description={\`Are you sure you want to revoke the invitation for \${inv.email}?\`}
                          onConfirm={async () => {
                            setActionLoading(true);
                            try {
                              await fetchApi(\`/events/\${event.id}/invites/\${inv.id}\`, { method: 'DELETE' });
                              toast.success('Invitation revoked');
                              onUpdate();
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                        >
                          <Button size=\"sm\" variant=\"outline\" disabled={actionLoading} title=\"Revoke\">
                            <Trash2 className=\"w-4 h-4 text-red-600\" />
                          </Button>
                        </ConfirmDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;

content = content.replace(
  `      {/* Member Management */}`,
  invitesSection + `\n      {/* Member Management */}`
);

fs.writeFileSync('src/components/event/AdminTab.tsx', content);
