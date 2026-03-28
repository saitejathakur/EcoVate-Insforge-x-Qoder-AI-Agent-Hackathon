/**
 * Vision Agent
 * 
 * Uses Gemini 1.5 Pro to analyze product packaging images.
 * Extracts: product name, materials, label text, packaging type.
 */

import { ai } from '../insforge';

export interface VisionResult {
  product_name: string;
  detected_materials: string[];
  label_text: string;
  packaging_type: string;
  confidence: number;
}

export async function runVisionAgent(imageBase64: string): Promise<{ result: VisionResult | null; error: Error | null }> {
  try {
    const prompt = `
Analyze this product packaging image and extract the following information:

1. Product name (as shown on packaging)
2. Detected materials (list all materials visible: plastic, glass, paper, metal, cardboard, etc.)
3. Label text (any recycling symbols, material codes, or environmental claims)
4. Packaging type (bottle, box, bag, jar, can, wrapper, etc.)

Respond ONLY with a JSON object in this exact format:
{
  "product_name": "string",
  "detected_materials": ["material1", "material2"],
  "label_text": "string with any text found",
  "packaging_type": "string",
  "confidence": number between 0-1
}

If any information is unclear, make your best estimate and set confidence accordingly.
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
    console.log('Vision Agent AI response:', JSON.stringify(response, null, 2));

    // Check if response has the expected structure
    if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.error('Unexpected AI response structure:', response);
      throw new Error('Invalid AI response structure');
    }

    // Parse the response
    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      throw new Error('Invalid response format from Vision Agent');
    }

    const result = JSON.parse(jsonMatch[0]) as VisionResult;
    
    // Validate required fields
    if (!result.product_name || !result.packaging_type) {
      throw new Error('Missing required fields in Vision Agent response');
    }

    return { result, error: null };
  } catch (error) {
    console.error('Vision Agent error:', error);
    return { 
      result: null, 
      error: error as Error 
    };
  }
}
