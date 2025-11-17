// src/services/rateLimitService.ts

import { supabase } from '../lib/supabaseClient';

export interface RateLimitInfo {
  messagesRemaining: number;
  maxMessages: number;
  resetTime: Date | null;
  isLimited: boolean;
  waitTimeMinutes: number;
}

const RATE_LIMIT_WINDOW = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const MAX_MESSAGES_PER_WINDOW = 50; // Sesuaikan dengan kebutuhan

export const checkRateLimit = async (): Promise<RateLimitInfo> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get or create rate limit record
    let { data: rateLimitData, error } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const now = new Date();

    // If no record exists, create one
    if (error || !rateLimitData) {
      const newRecord = {
        user_id: user.id,
        message_count: 0,
        window_start: now.toISOString(),
        last_message_at: null,
      };

      const { data: newData, error: insertError } = await supabase
        .from('rate_limits')
        .insert(newRecord)
        .select()
        .single();

      if (insertError) throw insertError;
      rateLimitData = newData;
    }

    const windowStart = new Date(rateLimitData.window_start);
    const timeElapsed = now.getTime() - windowStart.getTime();

    // Reset window if expired
    if (timeElapsed >= RATE_LIMIT_WINDOW) {
      const { data: resetData, error: resetError } = await supabase
        .from('rate_limits')
        .update({
          message_count: 0,
          window_start: now.toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (resetError) throw resetError;
      rateLimitData = resetData;
    }

    const messagesRemaining = MAX_MESSAGES_PER_WINDOW - rateLimitData.message_count;
    const isLimited = messagesRemaining <= 0;
    const resetTime = new Date(windowStart.getTime() + RATE_LIMIT_WINDOW);
    const waitTimeMinutes = Math.ceil((resetTime.getTime() - now.getTime()) / (60 * 1000));

    return {
      messagesRemaining: Math.max(0, messagesRemaining),
      maxMessages: MAX_MESSAGES_PER_WINDOW,
      resetTime: isLimited ? resetTime : null,
      isLimited,
      waitTimeMinutes: isLimited ? waitTimeMinutes : 0,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    throw error;
  }
};

export const incrementMessageCount = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase.rpc('increment_message_count', {
      p_user_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error incrementing message count:', error);
    throw error;
  }
};

export const getRateLimitStatus = async (): Promise<RateLimitInfo> => {
  return await checkRateLimit();
};