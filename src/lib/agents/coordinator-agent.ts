/**
 * Coordinator Agent
 * 
 * Orchestrates the 3 sub-agents in sequence:
 * Vision Agent → Research Agent → DIY Agent
 * Returns aggregated results with error handling.
 */

import { runVisionAgent } from './vision-agent';
import { runResearchAgent } from './research-agent';
import { runDIYAgent } from './diy-agent';
import type { ScanResult } from '../insforge';

export interface CoordinatorResult {
  success: boolean;
  data?: ScanResult;
  partialData?: Partial<ScanResult>;
  errors: string[];
  executionTimeMs: number;
}

export async function runCoordinatorAgent(imageBase64: string): Promise<CoordinatorResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const partialData: Partial<ScanResult> = {};

  try {
    // Step 1: Vision Agent
    console.log('Coordinator: Running Vision Agent...');
    const { result: visionResult, error: visionError } = await runVisionAgent(imageBase64);
    
    if (visionError || !visionResult) {
      errors.push(`Vision Agent failed: ${visionError?.message || 'Unknown error'}`);
      return {
        success: false,
        errors,
        executionTimeMs: Date.now() - startTime,
      };
    }

    partialData.product_name = visionResult.product_name;
    partialData.detected_materials = visionResult.detected_materials;
    partialData.label_text = visionResult.label_text;
    partialData.packaging_type = visionResult.packaging_type;

    // Step 2 & 3: Run Research and DIY agents in PARALLEL for speed
    console.log('Coordinator: Running Research and DIY Agents in parallel...');
    
    const [researchResult, diyResult] = await Promise.all([
      runResearchAgent(visionResult.detected_materials, visionResult.packaging_type),
      runDIYAgent(visionResult.packaging_type, visionResult.detected_materials),
    ]);

    // Process Research Agent result
    if (researchResult.error || !researchResult.result) {
      errors.push(`Research Agent failed: ${researchResult.error?.message || 'Unknown error'}`);
    } else {
      partialData.carbon_footprint_kg = researchResult.result.carbon_footprint_kg;
      partialData.recyclability_score = researchResult.result.recyclability_score;
      partialData.material_breakdown = researchResult.result.material_breakdown.map(m => ({
        material: m.material,
        percentage: m.percentage,
      }));
    }

    // Process DIY Agent result
    if (diyResult.error || !diyResult.ideas) {
      errors.push(`DIY Agent failed: ${diyResult.error?.message || 'Unknown error'}`);
    } else {
      partialData.diy_ideas = diyResult.ideas;
    }

    const executionTimeMs = Date.now() - startTime;

    // Check if we have enough data to return success
    const hasMinimumData = partialData.product_name && partialData.packaging_type;
    
    if (hasMinimumData) {
      return {
        success: errors.length === 0,
        data: partialData as ScanResult,
        partialData: errors.length > 0 ? partialData : undefined,
        errors,
        executionTimeMs,
      };
    } else {
      return {
        success: false,
        partialData,
        errors: [...errors, 'Insufficient data collected'],
        executionTimeMs,
      };
    }
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    errors.push(`Coordinator error: ${(error as Error).message}`);
    
    return {
      success: false,
      partialData: Object.keys(partialData).length > 0 ? partialData : undefined,
      errors,
      executionTimeMs,
    };
  }
}
