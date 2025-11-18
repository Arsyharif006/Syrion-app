// src/services/rateLimitService.ts

import { supabase } from '../lib/supabaseClient';

export interface RateLimitInfo {
  messagesRemaining: number;
  maxMessages: number;
  resetTime: Date | null;
  isLimited: boolean;
  waitTimeMinutes: number;
  plan?: string;
}

const RATE_LIMIT_WINDOW = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const FREE_MAX_MESSAGES = 30; // Free plan limit
const DEMO_MAX_MESSAGES = 100; // Demo plan limit
const PRO_MAX_MESSAGES = 999999; // Pro plan (unlimited)

export const checkRateLimit = async (): Promise<RateLimitInfo> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check user's billing plan
    const { data: billingData } = await supabase
      .from('user_billing')
      .select('plan, expires_at')
      .eq('user_id', user.id)
      .single();

    let userPlan = 'free';
    let maxMessages = FREE_MAX_MESSAGES;

    if (billingData) {
      // Check if demo plan is expired
      if (billingData.plan === 'demo' && billingData.expires_at) {
        const expiresAt = new Date(billingData.expires_at);
        const now = new Date();
        
        if (now > expiresAt) {
          // Demo expired, revert to free
          await supabase
            .from('user_billing')
            .update({ 
              plan: 'free',
              expires_at: null 
            })
            .eq('user_id', user.id);
          
          userPlan = 'free';
          maxMessages = FREE_MAX_MESSAGES;
        } else {
          userPlan = 'demo';
          maxMessages = DEMO_MAX_MESSAGES;
        }
      } else {
        userPlan = billingData.plan;
        
        // Set max messages based on plan
        switch (billingData.plan) {
          case 'demo':
            maxMessages = DEMO_MAX_MESSAGES;
            break;
          case 'pro':
            maxMessages = PRO_MAX_MESSAGES;
            break;
          default:
            maxMessages = FREE_MAX_MESSAGES;
        }
      }
    }

    // Pro users have unlimited messages
    if (userPlan === 'pro') {
      return {
        messagesRemaining: PRO_MAX_MESSAGES,
        maxMessages: PRO_MAX_MESSAGES,
        resetTime: null,
        isLimited: false,
        waitTimeMinutes: 0,
        plan: userPlan,
      };
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

    const messagesRemaining = maxMessages - rateLimitData.message_count;
    const isLimited = messagesRemaining <= 0;
    const resetTime = new Date(windowStart.getTime() + RATE_LIMIT_WINDOW);
    const waitTimeMinutes = Math.ceil((resetTime.getTime() - now.getTime()) / (60 * 1000));

    return {
      messagesRemaining: Math.max(0, messagesRemaining),
      maxMessages,
      resetTime: isLimited ? resetTime : null,
      isLimited,
      waitTimeMinutes: isLimited ? waitTimeMinutes : 0,
      plan: userPlan,
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

    // Check if user is Pro (unlimited messages)
    const { data: billingData } = await supabase
      .from('user_billing')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    // Don't increment for Pro users
    if (billingData?.plan === 'pro') {
      return;
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