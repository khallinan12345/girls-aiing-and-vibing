import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify user token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = user.id;

  try {
    // Check if user already has baseline
    const { data: existing } = await supabase
      .from('user_personality_baseline')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return res.status(200).json({ 
        message: 'Baseline already exists', 
        exists: true 
      });
    }

    // Check if user has 10+ activities
    const { count } = await supabase
      .from('dashboard')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!count || count < 10) {
      return res.status(200).json({ 
        message: 'Not enough activities yet',
        count: count || 0,
        threshold: 10
      });
    }

    // Trigger baseline assessment asynchronously
    // Don't await - let it run in background
    execAsync(`npm run assess:baseline ${userId}`)
      .then(() => console.log(`✅ Baseline assessment completed for ${userId}`))
      .catch((err) => console.error(`❌ Baseline assessment failed for ${userId}:`, err));

    return res.status(202).json({ 
      message: 'Baseline assessment triggered',
      userId,
      activityCount: count
    });

  } catch (error: any) {
    console.error('Error triggering baseline:', error);
    return res.status(500).json({ error: error.message });
  }
}