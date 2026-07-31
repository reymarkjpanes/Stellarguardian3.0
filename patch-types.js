const fs = require('fs');
let src = fs.readFileSync('web/types/supabase.ts', 'utf8');

const enumDef = `      notification_type: 'judge_assignment' | 'team_invitation' | 'registration_approval' | 'submission_received' | 'submission_deadline_reminder' | 'judging_completed' | 'winner_announcement' | 'prize_approved' | 'escrow_funded' | 'payout_completed' | 'system_announcement';`;
src = src.replace(/Enums: \{/, 'Enums: {\n' + enumDef);

const tableDef = `      notifications: { Row: { id: string; user_id: string; type: Database['public']['Enums']['notification_type']; title: string; message: string; related_entity_type: string | null; related_entity_id: string | null; action_url: string | null; is_read: boolean; created_at: string; }; Insert: { id?: string; user_id: string; type: Database['public']['Enums']['notification_type']; title: string; message: string; related_entity_type?: string | null; related_entity_id?: string | null; action_url?: string | null; is_read?: boolean; created_at?: string; }; Update: { id?: string; user_id?: string; type?: Database['public']['Enums']['notification_type']; title?: string; message?: string; related_entity_type?: string | null; related_entity_id?: string | null; action_url?: string | null; is_read?: boolean; created_at?: string; }; Relationships: [ { foreignKeyName: 'notifications_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'users'; referencedColumns: ['id']; } ]; };`;
src = src.replace(/public: \{\s+Tables: \{/, 'public: {\n    Tables: {\n' + tableDef);

fs.writeFileSync('web/types/supabase.ts', src);
console.log('Types updated successfully!');
