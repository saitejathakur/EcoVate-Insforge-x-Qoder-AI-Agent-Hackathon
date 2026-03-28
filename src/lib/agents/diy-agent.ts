/**
 * DIY Creative Agent
 * 
 * Uses Gemini 1.5 Pro with Chain of Thought prompting to generate
 * upcycling ideas based on packaging materials and type.
 */

import { ai } from '../insforge';
import type { DIYIdea } from '../insforge';

export async function runDIYAgent(
  packagingType: string,
  detectedMaterials: string[]
): Promise<{ ideas: DIYIdea[]; error: Error | null }> {
  try {
    const prompt = `
You are a creative DIY upcycling expert. Given the following packaging information:

Packaging Type: ${packagingType}
Materials: ${detectedMaterials.join(', ')}

Generate 3 creative upcycling ideas that transform this packaging waste into useful items.

For each idea, provide:
1. A catchy title
2. Difficulty level (easy, medium, or hard)
3. Materials needed (besides the packaging itself)
4. Step-by-step instructions (3-5 steps)
5. Estimated CO2 saved in kg (realistic estimate based on diverting this waste)

Think step by step about each idea and make them practical and appealing.

Respond ONLY with a JSON array in this exact format:
[
  {
    "title": "string",
    "difficulty": "easy|medium|hard",
    "materials_needed": ["item1", "item2"],
    "steps": ["step 1", "step 2", "step 3"],
    "estimated_co2_saved_kg": number
  }
]
`;

    const response = await ai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });
    
    // Debug log
    console.log('DIY Agent AI response:', JSON.stringify(response, null, 2));

    // Check if response has the expected structure
    if (!response || !response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      console.error('Unexpected AI response structure:', response);
      throw new Error('Invalid AI response structure');
    }

    // Parse the response
    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('No JSON found in DIY response:', content);
      throw new Error('Invalid response format from DIY Agent');
    }

    const ideas = JSON.parse(jsonMatch[0]) as DIYIdea[];
    
    // Validate and sanitize
    const validatedIdeas = ideas.map(idea => ({
      title: idea.title || 'Untitled Project',
      difficulty: ['easy', 'medium', 'hard'].includes(idea.difficulty) 
        ? idea.difficulty 
        : 'medium' as const,
      materials_needed: Array.isArray(idea.materials_needed) ? idea.materials_needed : [],
      steps: Array.isArray(idea.steps) ? idea.steps : [],
      estimated_co2_saved_kg: typeof idea.estimated_co2_saved_kg === 'number' 
        ? idea.estimated_co2_saved_kg 
        : 0.5,
    }));

    return { ideas: validatedIdeas, error: null };
  } catch (error) {
    console.error('DIY Agent error:', error);
    
    // Return fallback ideas
    const fallbackIdeas: DIYIdea[] = [
      {
        title: `${packagingType} Planter`,
        difficulty: 'easy',
        materials_needed: ['soil', 'seeds or small plant'],
        steps: [
          `Clean the ${packagingType} thoroughly`,
          'Add drainage holes if needed',
          'Fill with potting soil',
          'Plant seeds or transplant a small plant',
          'Water and place in sunlight'
        ],
        estimated_co2_saved_kg: 0.3,
      },
      {
        title: `${packagingType} Storage Container`,
        difficulty: 'easy',
        materials_needed: ['decorative tape or paint (optional)'],
        steps: [
          `Clean and dry the ${packagingType}`,
          'Remove any labels if desired',
          'Decorate with tape or paint',
          'Use to store small items like buttons, coins, or office supplies'
        ],
        estimated_co2_saved_kg: 0.2,
      },
      {
        title: `${packagingType} Bird Feeder`,
        difficulty: 'medium',
        materials_needed: ['string or wire', 'bird seed', 'wooden spoons or sticks'],
        steps: [
          `Clean the ${packagingType} thoroughly`,
          'Cut feeding holes near the base',
          'Attach perches using wooden spoons or sticks',
          'Create a hanging mechanism with string or wire',
          'Fill with bird seed and hang outside'
        ],
        estimated_co2_saved_kg: 0.4,
      },
    ];

    return { ideas: fallbackIdeas, error: error as Error };
  }
}
