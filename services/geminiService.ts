
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Language, SearchResult, ImageMode } from "../types";

// Helper to get client
const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;
  try {
    const ai = getClient(apiKey);
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

export const generateMedicalIllustration = async (
    apiKey: string,
    term: string,
    mode: ImageMode,
    userInstructions?: string
): Promise<string | undefined> => {
    const ai = getClient(apiKey);
    try {
        // Step A: Generate a descriptive prompt for the image model
        let descriptionPrompt = `You are a medical visualization expert. `;
        
        if (mode === 'textbook') {
            // STRATEGY: Use Black & White Vintage Line Art (Gray's Anatomy Style).
            // This bypasses "Gore" filters by eliminating red/pink/flesh colors.
            descriptionPrompt += `
            Task: Create a prompt for a CLASSIC VINTAGE ANATOMY TEXTBOOK PAGE illustration for: "${term}".
            
            Guidelines:
            1. **Translation**: If the term "${term}" is not in English, translate it to English first.
            2. **Style**: "Vintage medical illustration, black and white ink drawing, cross-hatching, engraving style, Henry Gray style, parchment background, high contrast, clean lines, scientific labeling."
            3. **Safety**: "Technical diagram, NO organic textures, NO realistic flesh, NO blood, NO color".
            4. **Negative Prompt**: "Avoid: color, photography, realism, blood, red, pink, flesh, gore, blurred, distorted text."
            5. **Focus**: Detailed anatomical structure with clear separation like a textbook diagram.
            `;
        } else {
            // AI/Artistic Mode: Abstract but safe
            descriptionPrompt += `
            Task: Create a prompt for an abstract, artistic medical visualization for: "${term}".
            
            Guidelines:
            1. **Translation**: If the term "${term}" is not in English, translate it to English first.
            2. **Style**: "3D anatomical render, translucent medical model style, blue and grey aesthetic, clean studio lighting, high detail, educational purpose, no visceral textures."
            3. **Safety**: "Abstract representation, clean, sterile, NO blood, NO photorealism".
            4. **Negative Prompt**: "Avoid: photorealistic flesh, blood, open wounds, surgical gore, disturbing imagery."
            `;
        }

        if (userInstructions) {
             descriptionPrompt += `\n\nUSER REQUEST: Modify the visualization with: "${userInstructions}". Ensure the result remains safe and educational.`;
        }

        descriptionPrompt += `\n\nOutput ONLY the raw English prompt text.`;

        let enhancedPrompt = "";
        try {
            // We use Flash for the prompt engineering logic
            const descResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: descriptionPrompt,
            });
            enhancedPrompt = descResponse.text || "";
        } catch (e) {
            console.warn("Prompt generation failed, using fallback");
            enhancedPrompt = `Medical illustration of ${term}, black and white line art, vintage style`;
        }
        
        // Clean up the prompt string
        enhancedPrompt = enhancedPrompt.replace(/^Here is (the|a) prompt:?\s*/i, '').replace(/^Prompt:\s*/i, '').replace(/"/g, '').trim();
        
        // Append negative safety markers explicitly to EVERY request
        // This is the most critical part for safety
        enhancedPrompt += " --no blood --no gore --no photorealistic flesh --no color --no red --no pink";

        // Step B: Generate the image
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

        let imageResponse;
        try {
            // Use Flash Image for speed and better availability
            imageResponse = await generateImage('gemini-2.5-flash-image');
        } catch (e: any) {
             console.warn(`Flash model failed (${e.message}), trying Pro as backup.`);
             try {
                // Only try Pro if Flash fails
                imageResponse = await generateImage('gemini-3-pro-image-preview');
             } catch (fallbackError) {
                console.error("All image generation attempts failed", fallbackError);
                return undefined;
             }
        }

        // Correctly extract image
        for (const part of imageResponse?.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${part.inlineData.data}`;
            }
        }
        return undefined;
    } catch (imgError) {
        console.error("Image generation failed (Global Catch):", imgError);
        return undefined;
    }
};

export const searchMedicalTerm = async (
  apiKey: string,
  term: string,
  language: Language,
  imageMode: ImageMode = 'textbook'
): Promise<Partial<SearchResult>> => {
  const ai = getClient(apiKey);
  
  const prompt = language === 'ar' 
    ? `أنت موسوعة طبية شاملة.
       المهمة: شرح المصطلح الطبي التالي: "${term}".
       
       تعليمات هامة جداً:
       1. حتى لو كان المصطلح المدخل بلغة أخرى (مثل الإنجليزية)، يجب عليك ترجمته وشرحه باللغة العربية حصراً.
       2. يجب أن يكون المخرج النهائي (العناوين والمحتوى) بالكامل باللغة العربية.
       
       الهيكلة المطلوبة:
       1. **تعريف دقيق**: ما هو هذا العضو أو الحالة؟
       2. **الموقع**: أين يوجد بالضبط في الجسم؟ (إن وجد)
       3. **الوظائف الرئيسية**: ماذا يفعل؟
       4. **الأهمية السريرية**: الأمراض المرتبطة به.
       استخدم عناوين عريضة واضحة. يجب أن يكون الشرح دقيقاً ومستنداً إلى مراجع علمية.`
    : `You are a comprehensive medical encyclopedia.
       Task: Explain the following medical term: "${term}".
       
       CRITICAL INSTRUCTION: The user's interface is in ENGLISH. Even if the search term provided is in Arabic or another language (e.g., "${term}"), you MUST:
       1. Identify the English medical term.
       2. Provide the explanation entirely in ENGLISH.
       3. Do not output Arabic text.
       
       Structure the response with bold headers:
       1. **Definition**: Precise medical definition.
       2. **Location**: Anatomical position (if applicable).
       3. **Functions/Physiology**: Key roles and mechanisms.
       4. **Clinical Significance**: Common conditions or relevance.
       Use reliable scientific sources (e.g., Gray's Anatomy, Mayo Clinic). The tone should be educational and professional.`;

  try {
    // Generate text explanation
    const textPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Generate image in parallel
    const imagePromise = generateMedicalIllustration(apiKey, term, imageMode);

    const [textResponse, imageUrl] = await Promise.all([textPromise, imagePromise]);

    const explanation = textResponse.text || (language === 'ar' ? "لم يتم العثور على شرح." : "No explanation found.");
    
    // Extract grounding sources
    const sources = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((source: any) => source !== null) || [];

    return {
      term,
      explanation,
      sources,
      images: {
        [imageMode]: imageUrl
      },
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
