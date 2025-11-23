import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Language, SearchResult } from "../types";

// Helper to get client
const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;
  try {
    const ai = getClient(apiKey);
    // Use standard flash for validation as it's the main driver
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "ping",
    });
    return true;
  } catch (error) {
    console.error("API Key validation failed", error);
    return false;
  }
};

export const searchMedicalTerm = async (
  apiKey: string,
  term: string,
  language: Language
): Promise<Partial<SearchResult>> => {
  const ai = getClient(apiKey);
  
  const prompt = language === 'ar' 
    ? `اشرح المصطلح الطبي "${term}" بشكل بسيط وكافٍ. استخدم مصادر علمية موثوقة. يجب أن يكون الشرح باللغة العربية.`
    : `Explain the medical term "${term}" simply but adequately. Use reliable and scientific sources. The explanation must be in English.`;

  try {
    // 1. Text Explanation with Grounding (Start parallel)
    const textPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // 2. Generate Illustration (Start parallel)
    const imagePromise = (async () => {
        try {
            // Step A: Generate a descriptive prompt for the image model
            // Enhanced prompt engineering to ensure medical accuracy using Google Search Grounding
            const descriptionPrompt = `You are a medical visualization expert. 
            First, use Google Search to find authoritative visual descriptions for the medical term: "${term}".
            Then, based on the search results, create a precise image generation prompt for a medical textbook illustration.
            
            Strictly follow these guidelines:
            1. Accuracy: Focus EXCLUSIVELY on the anatomical structure "${term}". Isolate the specific organ or part. (Example: If term is "Larynx", show ONLY the Larynx, do NOT show the Lungs).
            2. Detail: Specify the precise anatomical view (e.g., "Anterior view", "Cross-section", "Cutaway").
            3. Style: "Medical anatomy chart, white background, clean lines, high definition".
            4. Labelling: The user explicitly requests structure identification. Include "Anatomical labels with leader lines pointing to key parts" in the prompt.
            5. Translation: Ensure the final prompt is in English.
            
            Output ONLY the raw English prompt text.`;

            const descResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: descriptionPrompt,
                config: { tools: [{ googleSearch: {} }] } // Critical: Grounding for accuracy
            });
            
            let enhancedPrompt = descResponse.text || `Medical illustration of ${term}, labeled anatomical chart, white background`;
            // Clean up prompt
            enhancedPrompt = enhancedPrompt.replace(/^Here is (the|a) prompt:?\s*/i, '').replace(/^Prompt:\s*/i, '').replace(/"/g, '');

            // Helper to try generating with a specific model
            const generateImage = async (modelName: string) => {
                return await ai.models.generateContent({
                    model: modelName,
                    contents: { parts: [{ text: enhancedPrompt }] },
                    config: {
                        imageConfig: {
                            aspectRatio: "4:3",
                        }
                    }
                });
            };

            // Step B: Generate the image using the enhanced prompt with fallback
            let imageResponse;
            try {
                // Try High Quality Pro Model first
                imageResponse = await generateImage('gemini-3-pro-image-preview');
            } catch (e: any) {
                 const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
                 // Fallback to Flash Image if Pro is permission denied (403), not found (404), or quota exceeded (429)
                 if (errStr.includes('403') || errStr.includes('PERMISSION_DENIED') || 
                     errStr.includes('404') || errStr.includes('NOT_FOUND') ||
                     errStr.includes('429')) {
                    console.warn(`Pro model failed, falling back to Flash Image. Error: ${e.message}`);
                    imageResponse = await generateImage('gemini-2.5-flash-image');
                 } else {
                    throw e;
                 }
            }

            for (const part of imageResponse?.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        } catch (imgError) {
            console.error("Image generation failed:", imgError);
            return undefined;
        }
    })();

    // Wait for both
    const [textResponse, imageUrl] = await Promise.all([textPromise, imagePromise]);

    const explanation = textResponse.text || (language === 'ar' ? "لم يتم العثور على شرح." : "No explanation found.");
    
    // Extract sources if available
    const sources = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((source: any) => source !== null) || [];

    return {
      term,
      explanation,
      sources,
      imageUrl,
      timestamp: Date.now(),
    };

  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  apiKey: string,
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  language: Language,
  contextTerm: string
): Promise<string> => {
  const ai = getClient(apiKey);
  const systemInstruction = language === 'ar'
    ? `أنت مساعد طبي ذكي. المستخدم يسأل عن المصطلح الطبي: "${contextTerm}". أجب عن الأسئلة بوضوح ودقة بناءً على الحقائق الطبية.`
    : `You are a helpful medical assistant. The user is asking about the medical term: "${contextTerm}". Answer questions clearly and accurately based on medical facts.`;

  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: { systemInstruction },
    history: history.map(h => ({
        role: h.role,
        parts: h.parts
    }))
  });

  const response: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
  return response.text || "";
};