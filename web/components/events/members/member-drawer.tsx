import { useEffect } from "react";

interface UserInfo {
  display_name: string;
  email: string;
}

interface Member {
  id: string;
  event_id: string;
  user_id: string;
  role: string;
  availability: string;
  skills: string[];
  timezone: string | null;
  users: UserInfo;
  inTeam: boolean;
  teamId: string | null;
}

interface MemberDrawerProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  isOrganizer: boolean;
}

export function MemberDrawer({ member, isOpen, onClose, isOrganizer }: MemberDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[var(--bg)] shadow-2xl transition-transform duration-300 translate-x-0 border-l border-[var(--border)] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-medium text-lg">Member Details</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-md hover:bg-[var(--bg-muted)] text-[var(--text-muted)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl uppercase">
               {member.users.display_name.charAt(0)}
             </div>
             <div>
                <h3 className="text-xl font-semibold">{member.users.display_name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{member.users.email}</p>
             </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Role & Status</p>
              <div className="flex flex-wrap gap-2">
                 <span className="rounded-full bg-[var(--bg-muted)] border border-[var(--border)] px-3 py-1 text-sm font-medium">
                   {member.role}
                 </span>
                 {member.inTeam ? (
                    <span className="rounded-full bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-3 py-1 text-sm font-medium">
                      In Team
                    </span>
                 ) : (
                    <span className="rounded-full bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 px-3 py-1 text-sm font-medium">
                      {member.availability}
                    </span>
                 )}
              </div>
            </div>

            {member.timezone && (
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Timezone</p>
                <p className="text-sm">{member.timezone}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                 {member.skills?.length > 0 ? (
                    member.skills.map(s => (
                       <span key={s} className="rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-xs">
                         {s}
                       </span>
                    ))
                 ) : (
                    <p className="text-sm text-[var(--text-muted)] italic">No skills listed</p>
                 )}
              </div>
            </div>
          </div>

          {isOrganizer && (
             <div className="border-t border-[var(--border)] pt-6">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500 mb-3">Management</p>
                <div className="space-y-3">
                   <button className="w-full rounded-md border border-[var(--border)] py-2 text-sm font-medium hover:bg-[var(--bg-muted)] transition-colors">
                     Edit Role
                   </button>
                   <button className="w-full rounded-md border border-[var(--error)] py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors">
                     Remove from Event
                   </button>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
