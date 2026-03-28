/**
 * GET /api/leaderboard
 * 
 * Returns top users ranked by sustainability score.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    // Get top users by sustainability score
    const { data: topUsers, error } = await db
      .from('users')
      .select('id, name, avatar, sustainability_score, created_at')
      .order('sustainability_score', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    // Add rank to each user
    const rankedUsers = (topUsers || []).map((user: { id: string; name: string; avatar: string; sustainability_score: number; created_at: string }, index: number) => ({
      rank: index + 1,
      ...user,
    }));

    return NextResponse.json({
      success: true,
      leaderboard: rankedUsers,
    });

  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}

export const runtime = 'edge';
