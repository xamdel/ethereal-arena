import { LLMCharacterOutput, StartingCardData, CharacterData } from '../types/character'; // Use CharacterData
import { llmClient } from './api-client'; // Adjusted import path
import { generateImage } from '../image-generation'; // Import the image generation function
import { performance } from 'perf_hooks'; // Import performance for more precise timing
import { generateCharacterPrompt, generateCardArtPrompt, ART_STYLE_SYSTEM_PROMPT } from './art-prompts'; // Import art style utilities
import { characterSchema } from './schemas';

// Define a type for our timing results
type TimingResults = {
  [key: string]: number;
};

/**
 * Generate character details using the LLM based on a class name.
 * @param className - The class name provided by the user.
 * @returns A promise that resolves with the final character data including image URLs.
 */
export async function generateCharacterDetails(className: string): Promise<CharacterData> { // Return CharacterData
  const timings: TimingResults = {}; // Object to store timestamps
  const imageDurations: { [key: string]: number } = {}; // Object to store individual image durations
  timings.start = performance.now();
  console.log(`[CharacterGenerator] Generating character details for class: ${className}`);

  let llmDetails: LLMCharacterOutput;
  let finalCharacterData: CharacterData | null = null; // Use CharacterData, Initialize as null
  let errorOccurred: any | null = null; // Track errors for finally block, use 'any' for flexibility with added properties

  try { // Main try block starts here

    // --- Step 1: Generate Text Details via LLM ---
    try { // Inner try for Step 1
      console.log('[CharacterGenerator] Step 1: Calling LLM for text details...');
    timings.llmCallStart = performance.now();
    // Define prompts and schema inside the try block as they are only needed here
    const systemPrompt = `You are a creative assistant specializing in fantasy character class concepts for a card game. Generate detailed and evocative content for the requested class archetype, adhering strictly to the required JSON schema fields.

${ART_STYLE_SYSTEM_PROMPT}

Key Instructions:
1.  **Class Focus, Not Character:** Generate a description for a class archetype, not a specific named character. Keep 'descriptionAndBackstory' short, generic, and focused on the class identity/origins. Do NOT invent a name for the character/class.
2.  **Concise Class Features:** 'classFeatures' must be exactly 3 short, single sentences describing the high-level playstyle or unique mechanics of the class.
3.  **Starting Cards:** Generate exactly 6 'startingCards', each including ALL 5 required fields:
   - abilityName: Name of the ability
   - artPrompt: Visual description (content only, no style)
   - effects: Game mechanics (e.g., "Deal 8 damage", "Gain 5 block", "Heal 6 health")
   - flavorText: Short atmospheric text
   - cost: Energy cost (0-5)
   
   Example card structure:
   {
     "abilityName": "Fire Bolt",
     "artPrompt": "A blazing projectile flying through the air toward a target",
     "effects": "Deal 7 damage to target enemy",
     "flavorText": "A spark of destruction from ancient flames.",
     "cost": 2
   }
4.  **Adhere to Schema:** Strictly follow the provided JSON schema structure and types for all fields.`;

  const userPrompt = `Generate a complete character class concept for the archetype "${className}". Provide creative details for all required fields:
-   **fullBodyPrompt:** Focus ONLY on character appearance, pose, and environment content. Describe the character's physical features, clothing, equipment, dynamic action pose, and thematic background scene. Do NOT include any style, mood, or artistic direction.
-   **descriptionAndBackstory:** A short, generic paragraph about the class archetype.
-   **classFeatures:** Exactly 3 concise sentences defining the class playstyle.
-   **startingCards:** Exactly 6 starting cards, each with ALL required fields:
    * **abilityName:** The name of the ability
    * **artPrompt:** Visual description focusing ONLY on content (no style directions)
    * **effects:** Game mechanics description (damage, healing, buffs, etc.)
    * **flavorText:** Short atmospheric text that adds personality
    * **cost:** Energy cost (0-5)

CRITICAL: Every card MUST include all 5 fields (abilityName, artPrompt, effects, flavorText, cost). Do not omit any fields.
Remember: Art style will be applied automatically for consistency. Focus on clear, detailed content descriptions that maintain visual consistency across all prompts.`;

  // Construct the response_format object for the API call
  const responseFormat = {
    type: 'json_schema' as const, // Use 'as const' for literal type
    json_schema: characterSchema,
  };

    const response = await llmClient.complete(userPrompt, {
      systemPrompt,
      temperature: 0.6, // Slightly higher temperature for creativity
      response_format: responseFormat, // Pass the structured output format
    });
    timings.llmCallEnd = performance.now(); // Record LLM call end time

    // With structured output, response.content should already be valid JSON
    llmDetails = JSON.parse(response.content) as LLMCharacterOutput;
    timings.jsonParseEnd = performance.now(); // Record JSON parsing end time

    // --- Add Transformation Step ---
    // Handle potential 'name' vs 'abilityName' discrepancy from LLM
    if (llmDetails.startingCards && Array.isArray(llmDetails.startingCards)) {
      llmDetails.startingCards.forEach((card: any) => { // Use 'any' temporarily for flexibility
        if (card && typeof card.name === 'string' && card.name && typeof card.abilityName === 'undefined') {
          console.warn(`[CharacterGenerator] Found 'name' ("${card.name}") instead of 'abilityName' for a card. Transforming.`);
          card.abilityName = card.name;
          // Optionally delete the original 'name' property if desired
          // delete card.name;
        }
      });
    }
    // --- End Transformation Step ---

      // Minimal validation - schema handles structure, just check counts
      if (!llmDetails.fullBodyPrompt || !llmDetails.descriptionAndBackstory || 
          !Array.isArray(llmDetails.classFeatures) || llmDetails.classFeatures.length !== 3 ||
          !Array.isArray(llmDetails.startingCards) || llmDetails.startingCards.length !== 6) {
        throw new Error('LLM output validation failed - incorrect array counts.');
      }

        console.log('[CharacterGenerator] Successfully parsed and validated character details from LLM response.');
        timings.validationEnd = performance.now(); // Record validation end time
        // Proceed to image generation
      } catch (error) {
        timings.llmError = performance.now(); // Record time if LLM step fails
        // This catch block now handles errors from the API call and JSON parsing/validation
        console.error(`[CharacterGenerator] Error during LLM interaction (Step 1): ${error instanceof Error ? error.message : String(error)}`);
        const processedError = error instanceof Error ? error : new Error(String(error));
        errorOccurred = Object.assign(processedError, { step: 'llm' }); // Store error
        throw errorOccurred; // Re-throw to be caught by the outer catch
      }
      // --- End Step 1 ---

      // If Step 1 failed, an error would have been thrown, so we can assume llmDetails is populated if we reach here.

    // --- Step 2: Generate Images using Fal.ai ---
    console.log('[CharacterGenerator] Step 2: Calling Fal.ai for image generation...');

    // Helper function to time individual image generation calls and store duration
    async function timeImageGeneration(label: string, prompt: string, model: string, size: string | { width: number; height: number }): Promise<string> {
      const startTime = performance.now();
      try {
        const result = await generateImage(prompt, model, size);
        const endTime = performance.now();
        const duration = endTime - startTime;
        imageDurations[label] = duration; // Store duration
        return result;
      } catch (error) {
        const endTime = performance.now();
        // Calculate duration within catch scope
        const duration = endTime - startTime;
        imageDurations[label] = duration; // Store duration even on failure
        console.error(`[CharacterGenerator] FAILED image generation for: ${label}`, error);
        // Re-throw the error to be caught by the main try/catch block
        throw error; // Error type is handled by the outer catch
      }
    }

    timings.imageGenerationStart = performance.now();
    // Define model names and image sizes
    const fullBodyModel = 'fal-ai/flux-1/schnell';
    const fullBodySize = 'square';
    const portraitModel = 'rundiffusion-fal/juggernaut-flux/lightning';
    const portraitSize = 'square';
    const cardArtModel = 'fal-ai/flux-1/schnell'; // Assuming this model exists and accepts 'square'
    const cardArtSize =  {
                          "width": 128,
                          "height": 128
                          };

    // Apply consistent art styles to prompts
    console.log('[CharacterGenerator] Applying consistent art styles to prompts...');
    const styledFullBodyPrompt = generateCharacterPrompt(llmDetails.fullBodyPrompt, '', '');
    const styledCardPrompts = llmDetails.startingCards.map(card => 
      generateCardArtPrompt(card.artPrompt, '')
    );

    // Create promises for all image generations using the timing helper
    console.log('[CharacterGenerator] Creating image generation promises...');
    const imagePromises = [
      timeImageGeneration('Full Body', styledFullBodyPrompt, fullBodyModel, fullBodySize),
      // timeImageGeneration('Portrait', llmDetails.facialPortraitPrompt, portraitModel, portraitSize), // Removed portrait generation
      ...styledCardPrompts.map((styledPrompt, index) =>
        timeImageGeneration(`Card Art ${index + 1}`, styledPrompt, cardArtModel, cardArtSize)
      ),
    ];

    // Wait for all images to be generated
    console.log(`[CharacterGenerator] Awaiting Promise.all for ${imagePromises.length} images...`);
    const imageUrls = await Promise.all(imagePromises);
    timings.imageGenerationEnd = performance.now(); // Record end of Promise.all
    console.log(`[Performance] Total image generation (parallel) took ${(timings.imageGenerationEnd - timings.imageGenerationStart).toFixed(2)}ms`);

    // Extract URLs
    const fullBodyImageUrl = imageUrls[0];
    // const facialPortraitImageUrl = imageUrls[1]; // Removed portrait URL extraction
    const cardArtUrls = imageUrls.slice(1); // The rest are card art URLs (index adjusted)

    // --- Step 3: Construct Final CharacterData ---
    console.log('[CharacterGenerator] Step 3: Constructing final CharacterData...');
    timings.finalConstructionStart = performance.now();
    const constructedData: CharacterData = { // Use CharacterData type
      className: className, // Include the original class name
      descriptionAndBackstory: llmDetails.descriptionAndBackstory,
      classFeatures: llmDetails.classFeatures,
      fullBodyImageUrl: fullBodyImageUrl,
      // facialPortraitImageUrl: facialPortraitImageUrl, // Removed portrait URL from final data
      startingCards: llmDetails.startingCards.map((card, index) => ({
        abilityName: card.abilityName,
        effects: card.effects,
        flavorText: card.flavorText,
        cost: card.cost,
        artUrl: cardArtUrls[index], // Assign the corresponding generated URL
      })),
    };
    timings.finalConstructionEnd = performance.now();
    finalCharacterData = constructedData; // Assign to the outer scope variable

      console.log('[CharacterGenerator] Successfully generated all character data including images.');
      timings.successEnd = performance.now(); // Record successful completion time
      return finalCharacterData; // Return the constructed data

    } catch (error) { // Outer catch for any error thrown from Step 1, 2, or 3
      // If errorOccurred wasn't set by Step 1's catch, set it now
      if (!errorOccurred) {
          timings.generalError = performance.now(); // Use a general error time marker
          console.error(`[CharacterGenerator] Error during generation process (Steps 2/3): ${error instanceof Error ? error.message : String(error)}`);
          const processedError = error instanceof Error ? error : new Error(String(error));
          // Assign step if not already assigned by LLM error handling
          errorOccurred = Object.assign(processedError, { step: (error as any).step || 'image-generation/construction' });
      }
      // Ensure the originally caught error (now stored in errorOccurred) is thrown
      throw errorOccurred;
    } finally {
      // --- Performance Reporting ---
      // This block executes regardless of whether an error occurred or not.
      timings.finallyEnd = performance.now();
    const report: { [key: string]: string | { [key: string]: string } } = {};
    const totalDuration = (timings.finallyEnd - timings.start) / 1000; // seconds
    report['Total Execution Time'] = `${totalDuration.toFixed(3)}s`;

    if (timings.llmCallStart && timings.llmCallEnd) {
      report['LLM API Call'] = `${((timings.llmCallEnd - timings.llmCallStart) / 1000).toFixed(3)}s`;
    }
    if (timings.llmCallEnd && timings.jsonParseEnd) {
      report['LLM Response JSON Parsing'] = `${((timings.jsonParseEnd - timings.llmCallEnd) / 1000).toFixed(3)}s`;
    }
    if (timings.jsonParseEnd && timings.validationEnd) { // Corrected variable name
      report['LLM Response Validation'] = `${((timings.validationEnd - timings.jsonParseEnd) / 1000).toFixed(3)}s`;
    }
    if (timings.validationEnd && timings.imageGenerationStart) {
        report['Gap before Image Generation'] = `${((timings.imageGenerationStart - timings.validationEnd) / 1000).toFixed(3)}s`;
    }
    if (timings.imageGenerationStart && timings.imageGenerationEnd) {
      report['Image Generation (Promise.all)'] = `${((timings.imageGenerationEnd - timings.imageGenerationStart) / 1000).toFixed(3)}s`;
      const individualImagesReport: { [key: string]: string } = {};
      for (const [label, duration] of Object.entries(imageDurations)) {
        individualImagesReport[label] = `${(duration / 1000).toFixed(3)}s`;
      }
      report['Individual Image Times'] = individualImagesReport;
    }
    if (timings.imageGenerationEnd && timings.finalConstructionStart) { // Corrected variable name
        report['Gap before Final Construction'] = `${((timings.finalConstructionStart - timings.imageGenerationEnd) / 1000).toFixed(3)}s`;
    }
    if (timings.finalConstructionStart && timings.finalConstructionEnd) {
      report['Final Object Construction'] = `${((timings.finalConstructionEnd - timings.finalConstructionStart) / 1000).toFixed(3)}s`;
    }

    // Log potential error times using the general marker
    if (timings.generalError) report['Error Time'] = `${((timings.generalError - timings.start) / 1000).toFixed(3)}s (relative to start)`;
    // Add time until success if applicable
    if (timings.successEnd) report['Time until Success'] = `${((timings.successEnd - timings.start) / 1000).toFixed(3)}s`;


    console.log('\n--- Character Generation Performance Report ---');
    console.log(JSON.stringify(report, null, 2));
    console.log('---------------------------------------------\n');

    console.log('---------------------------------------------\n');

    // NOTE: No need to re-throw or check finalCharacterData here.
    // If an error occurred, it was already thrown in the catch block.
    // If no error occurred, the 'return finalCharacterData' in the try block already executed.
    // The finally block just adds logging.
  }
  // --- End Main Try/Catch/Finally ---
}
