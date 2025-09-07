/**
 * Art style definitions and prompt templates for consistent FLUX image generation
 * Following FLUX best practices for style adherence
 */

// Core art style definition - applied consistently across all generated images
export const CORE_ART_STYLE = {
  // Character art style - fantasy painting aesthetic
  character: `Style: digital fantasy painting, painterly brushstrokes, soft edges with selective sharp details, muted earth tones with selective vibrant accents (deep blues, warm golds, forest greens), atmospheric lighting with rim light, oil painting texture, concept art illustration style reminiscent of classic fantasy book covers from the 1980s-1990s

Mood & atmosphere: mystical, heroic, slightly stylized but grounded, cinematic composition`,

  // Card art style - more illustrative and graphic
  card: `Style: stylized fantasy illustration, clean vector-like shapes with painterly textures, limited color palette (4-5 colors max), bold compositional elements, graphic novel illustration style with soft cel-shading, subtle paper texture, reminiscent of modern fantasy card game art

Mood & atmosphere: focused, iconic, clear visual hierarchy, slightly stylized`
};

/**
 * Generate a character full-body prompt with consistent style
 */
export function generateCharacterPrompt(characterDescription: string, actionPose: string, backgroundScene: string): string {
  return `Subject/layout: ${characterDescription} in ${actionPose}, ${backgroundScene}, three-quarter view facing camera, medium shot showing full figure

${CORE_ART_STYLE.character}`;
}

/**
 * Generate a card art prompt with consistent style
 */
export function generateCardArtPrompt(cardDescription: string, focusElement: string): string {
  return `Subject/layout: ${cardDescription}, ${focusElement} as central focus, clear composition with strong silhouette, square format composition

${CORE_ART_STYLE.card}`;
}

/**
 * Enhanced prompt templates for the LLM to generate style-consistent descriptions
 */
export const LLM_STYLE_INSTRUCTIONS = {
  characterPrompt: `When creating the fullBodyPrompt, describe the character's appearance, clothing, and key visual elements, but do NOT include style, mood, or technical art direction - this will be added automatically. Focus on:
- Character's physical appearance (build, hair, facial features)
- Clothing and equipment details
- A dynamic action pose appropriate for their class
- A thematic background environment (tavern, forest clearing, ancient ruins, etc.)
- Ensure the character is clearly visible and facing mostly toward the camera

Example format: "A lean elven ranger with silver hair and leather armor, drawing a glowing bow while crouched on a moss-covered stone bridge, ancient forest with ethereal light filtering through canopy behind"`,

  cardArtPrompt: `When creating artPrompt for cards, describe the central visual element and composition, but do NOT include style, mood, or technical art direction - this will be added automatically. Focus on:
- The main subject/action of the card
- Key visual elements that represent the ability
- Simple, clear composition suitable for a square card format
- If the character appears, use consistent visual descriptors from the character description

Example format: "A magical flame erupting from an outstretched palm, energy wisps swirling around the hand, simple background with subtle magical symbols"`
};

/**
 * System prompt additions for the LLM to understand the art style requirements
 */
export const ART_STYLE_SYSTEM_PROMPT = `
IMPORTANT ART STYLE REQUIREMENTS:
- All visual descriptions should focus on CONTENT and COMPOSITION only
- Do NOT include style directions, mood descriptions, or technical art terms in your prompts
- The art style will be applied automatically to ensure consistency
- For character descriptions: focus on appearance, pose, and environment
- For card art descriptions: focus on the central action/element and basic composition
- Maintain visual consistency - if you describe the character with "silver hair" in the full body prompt, any card showing the character must also reference "silver hair"
- Keep descriptions clear and specific but avoid overly complex details

${LLM_STYLE_INSTRUCTIONS.characterPrompt}

${LLM_STYLE_INSTRUCTIONS.cardArtPrompt}`;
