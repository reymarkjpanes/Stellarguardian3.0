import { HeroCard } from "./hero-card";
import { MilestoneCard, MilestoneItem } from "./milestone-card";
import { QuickActionsCard, ActionItem } from "./quick-actions-card";
import { RoleSummaryCard, RoleStat } from "./role-summary-card";
import { AnnouncementCard, Announcement } from "./announcement-card";
import { ActivityFeedCard, ActivityItem } from "./activity-feed-card";

export interface EventActionCenterProps {
  eventName: string;
  currentPhase: string;
  countdownText: string;
  heroPrimaryActionLabel?: string;
  onHeroPrimaryAction?: () => void;
  
  role: string;
  milestones: MilestoneItem[];
  quickActions: ActionItem[];
  roleStats: RoleStat[];
  announcements: Announcement[];
  activities: ActivityItem[];
  loading?: boolean;
}

export function EventActionCenter({
  eventName,
  currentPhase,
  countdownText,
  heroPrimaryActionLabel,
  onHeroPrimaryAction,
  role,
  milestones,
  quickActions,
  roleStats,
  announcements,
  activities,
  loading,
}: EventActionCenterProps) {
  return (
    <div className="space-y-6">
      {/* 1. Contextual Hero */}
      <HeroCard 
        eventName={eventName} 
        currentPhase={currentPhase} 
        countdownText={countdownText} 
        primaryActionLabel={heroPrimaryActionLabel}
        onPrimaryAction={onHeroPrimaryAction}
        loading={loading}
      />
      
      {/* 2. Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6">
          <MilestoneCard items={milestones} loading={loading} />
          <AnnouncementCard announcements={announcements} loading={loading} />
          <ActivityFeedCard activities={activities} loading={loading} />
        </div>
        
        {/* Sidebar Column */}
        <div className="space-y-6">
          <RoleSummaryCard role={role} stats={roleStats} loading={loading} />
          <QuickActionsCard actions={quickActions} loading={loading} />
        </div>
      </div>
    </div>
  );
}
