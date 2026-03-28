/**
 * Verification Agent
 * 
 * Uses Gemini 1.5 Pro to verify if a user-submitted photo
 * shows a completed DIY upcycling project.
 */

import { ai } from '../insforge';

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  feedback: string;
}

export async function runVerificationAgent(
  imageBase64: string,
  packagingType: string,
  projectTitle: string
): Promise<{ result: VerificationResult | null; error: Error | null }> {
  try {
    const prompt = `
You are evaluating a DIY upcycling project verification photo.

Expected Project: A DIY project made from a "${packagingType}" 
Project Title: "${projectTitle}"

Analyze the submitted image and determine:
1. Does this image show a completed DIY upcycling project?
2. Does it appear to use the expected packaging material (${packagingType})?
3. How confident are you in this assessment?

Respond ONLY with a JSON object in this exact format:
{
  "verified": true or false,
  "confidence": number between 0-1,
  "feedback": "brief explanation of your assessment"
}

Be fair but accurate. A verified project should clearly show creative reuse of packaging materials.
`;

    const response = await ai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        },
      ],
      temperature: 0.2,
    });
    
    // Debug log
    console.log('Verification Agent AI response:', JSON.stringify(response, null, 2));

    // Check if response has the expected structure
    if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.error('Unexpected AI response structure:', response);
      throw new Error('Invalid AI response structure');
    }

    // Parse the response
    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found in verification response:', content);
      throw new Error('Invalid response format from Verification Agent');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const result: VerificationResult = {
      verified: Boolean(parsed.verified),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      feedback: String(parsed.feedback || 'No feedback provided'),
    };

    return { result, error: null };
  } catch (error) {
    console.error('Verification Agent error:', error);
    return { 
      result: null, 
      error: error as Error 
    };
  }
}
