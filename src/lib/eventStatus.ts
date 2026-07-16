export type EventState = 
  | 'Draft' 
  | 'Funded' 
  | 'Published' 
  | 'Registration Open' 
  | 'Registration Closed' 
  | 'In Progress' 
  | 'Judging' 
  | 'Completed' 
  | 'Archived' 
  | 'Cancelled';

export const EventStatus = {
  // Checks
  isDraft: (state: string) => state === 'Draft',
  isFunded: (state: string) => state === 'Funded',
  isPublished: (state: string) => state === 'Published',
  isRegistrationOpen: (state: string) => state === 'Registration Open',
  isRegistrationClosed: (state: string) => state === 'Registration Closed',
  isInProgress: (state: string) => state === 'In Progress',
  isJudging: (state: string) => state === 'Judging',
  isCompleted: (state: string) => state === 'Completed',
  isArchived: (state: string) => state === 'Archived',
  isCancelled: (state: string) => state === 'Cancelled',
  
  // Permissions
  canEdit: (state: string) => ['Draft', 'Funded', 'Published', 'Registration Open', 'Registration Closed', 'In Progress'].includes(state),
  canApply: (state: string) => state === 'Registration Open',
  canSubmit: (state: string) => state === 'In Progress',
  canScore: (state: string) => state === 'Judging',
  
  // Transitions
  canFund: (state: string) => state === 'Draft',
  canPublish: (state: string) => state === 'Funded',
  canOpenRegistration: (state: string) => state === 'Published',
  canCloseRegistration: (state: string) => state === 'Registration Open',
  canStartEvent: (state: string) => state === 'Registration Closed',
  canBeginJudging: (state: string) => state === 'In Progress',
  canComplete: (state: string) => state === 'Judging',
  canArchive: (state: string) => ['Completed', 'Cancelled'].includes(state),
  canCancel: (state: string) => !['Completed', 'Archived', 'Cancelled'].includes(state),
};

export type ActionType = 'edit' | 'apply' | 'submit' | 'score' | 'fund' | 'publish' | 'open_registration' | 'close_registration' | 'start_event' | 'begin_judging' | 'complete' | 'archive' | 'cancel';

export const isActionAllowed = (state: string, action: ActionType): boolean => {
  switch (action) {
    case 'edit': return EventStatus.canEdit(state);
    case 'apply': return EventStatus.canApply(state);
    case 'submit': return EventStatus.canSubmit(state);
    case 'score': return EventStatus.canScore(state);
    case 'fund': return EventStatus.canFund(state);
    case 'publish': return EventStatus.canPublish(state);
    case 'open_registration': return EventStatus.canOpenRegistration(state);
    case 'close_registration': return EventStatus.canCloseRegistration(state);
    case 'start_event': return EventStatus.canStartEvent(state);
    case 'begin_judging': return EventStatus.canBeginJudging(state);
    case 'complete': return EventStatus.canComplete(state);
    case 'archive': return EventStatus.canArchive(state);
    case 'cancel': return EventStatus.canCancel(state);
    default: return false;
  }
};
