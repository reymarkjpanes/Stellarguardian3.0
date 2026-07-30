import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSubmit() {
  const { data: events } = await supabase.from('events').select('id').limit(1);
  const eventId = events?.[0]?.id;
  
  const { data: teams } = await supabase.from('teams').select('id').limit(1);
  const teamId = teams?.[0]?.id;

  if (!eventId || !teamId) {
    console.log('No event or team found.');
    return;
  }

  console.log(`Using Event: ${eventId}, Team: ${teamId}`);

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      team_id: teamId,
      event_id: eventId,
      status: 'SUBMITTED',
      title: 'waddawawd',
      short_description: 'wda',
    });

  console.log('Insert result:', error || 'Success', data);
}

testSubmit().catch(console.error);
