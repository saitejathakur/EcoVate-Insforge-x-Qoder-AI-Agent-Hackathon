/**
 * POST /api/verify
 * 
 * Verification Agent endpoint that checks DIY completion photos.
 * Awards impact points if verification passes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runVerificationAgent } from '@/lib/agents';
import { db, auth } from '@/lib/insforge';
import { uploadImage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const formData = await request.formData();
    const bodyUserId = formData.get('userId') as string;
    
    // Verify authentication - accept userId from body
    let userId: string | null = bodyUserId || null;
    
    // Also try to verify with cookie as backup
    if (!userId) {
      const { data: userData } = await auth.getCurrentUser();
      if (userData?.user) {
        userId = userData.user.id;
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const imageFile = formData.get('image') as File;
    const scanId = formData.get('scanId') as string;
    const projectTitle = formData.get('projectTitle') as string;
    const packagingType = formData.get('packagingType') as string;
    const estimatedCo2Saved = parseFloat(formData.get('estimatedCo2Saved') as string) || 0.5;

    // Debug logging
    console.log('Verify request:', { 
      hasImage: !!imageFile, 
      scanId, 
      projectTitle, 
      packagingType,
      estimatedCo2Saved
    });

    // Check each field individually for better error messages
    const missingFields: string[] = [];
    if (!imageFile) missingFields.push('image');
    if (!scanId) missingFields.push('scanId');
    if (!projectTitle) missingFields.push('projectTitle');
    if (!packagingType) missingFields.push('packagingType');

    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        received: { scanId, projectTitle, packagingType }
      }, { status: 400 });
    }

    // Convert image to base64 for AI processing
    const bytes = await imageFile.arrayBuffer();
    const base64Image = `data:${imageFile.type};base64,${Buffer.from(bytes).toString('base64')}`;

    // Run Verification Agent
    console.log('Running Verification Agent...');
    const { result: verificationResult, error: verificationError } = await runVerificationAgent(
      base64Image,
      packagingType,
      projectTitle
    );

    if (verificationError || !verificationResult) {
      return NextResponse.json({
        success: false,
        error: verificationError?.message || 'Verification failed',
      }, { status: 500 });
    }

    // Upload verification image
    const { url: imageUrl, error: uploadError } = await uploadImage(
      imageFile, 
      `verifications/${userId}`
    );
    
    if (uploadError) {
      console.error('Image upload error:', uploadError);
    }

    // Determine verification status
    const isApproved = verificationResult.verified && verificationResult.confidence >= 0.85;
    const actionType = isApproved ? 'diy_completed' : 'diy_pending';
    
    // Calculate impact score (0 for pending)
    const impactScore = isApproved ? Math.round(10 + (estimatedCo2Saved * 20)) : 0;

    // Always save the verification attempt
    try {
      await db.from('user_actions').insert([{
        user_id: userId,
        scan_id: scanId,
        action_type: actionType,
        impact_score: impactScore,
        image_url: imageUrl,
      }]);
    } catch (dbErr) {
      console.error('Failed to save action:', dbErr);
    }

    // If approved, update user's cumulative score
    if (isApproved && impactScore > 0) {
      try {
        const { data: userData } = await db
          .from('users')
          .select('sustainability_score')
          .eq('id', userId)
          .single();

        if (userData) {
          await db
            .from('users')
            .update({ 
              sustainability_score: (userData.sustainability_score || 0) + impactScore 
            })
            .eq('id', userId);
        }
      } catch (scoreErr) {
        console.error('Failed to update score:', scoreErr);
      }
    }

    return NextResponse.json({
      success: true,
      verified: verificationResult.verified,
      confidence: verificationResult.confidence,
      feedback: verificationResult.feedback,
      impactScore,
      imageUrl,
    });

  } catch (error) {
    console.error('Verify API error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}

export const runtime = 'edge';
