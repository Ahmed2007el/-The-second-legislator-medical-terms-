
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
            descriptionPrompt += `
            First, use Google Search to find authoritative visual descriptions for the medical term: "${term}" from sources like Gray's Anatomy or Netter.
            Then, create a precise image generation prompt for a medical textbook illustration.
            
            Strictly follow these guidelines:
            1. **Isolation**: Focus EXCLUSIVELY on the "${term}". Isolate the organ/structure.
            2. **Style**: "Classic scientific anatomy illustration, white background, detailed, realistic colors".
            3. **Labelling**: The user explicitly demands "Anatomical labels with clear leader lines pointing to key parts".
            4. **Context**: Do not include unrelated surrounding organs unless absolutely necessary for orientation.
            `;
        } else {
            descriptionPrompt += `
            Create a highly detailed, photorealistic 3D medical visualization prompt for: "${term}".
            
            Guidelines:
            1. **Style**: Cinematic lighting, 3D render, hyper-realistic textures.
            2. **Presentation**: Artistic but anatomically correct. Dramatic close-ups are allowed.
            3. **Background**: Clean, professional studio environment or dark medical gradient.
            `;
        }

        if (userInstructions) {
             descriptionPrompt += `\n\nCRITICAL USER INSTRUCTION: The user wants to modify the image with this specific request: "${userInstructions}". Ensure the generated prompt explicitly includes these details to satisfy the user.`;
        }

        descriptionPrompt += `\n\nOutput ONLY the raw English prompt text.`;

        const descResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: descriptionPrompt,
            config: { tools: [{ googleSearch: {} }] } // Always use search for prompt accuracy
        });
        
        let enhancedPrompt = descResponse.text || `Medical illustration of ${term}, labeled anatomical chart, white background, isolated structure`;
        enhancedPrompt = enhancedPrompt.replace(/^Here is (the|a) prompt:?\s*/i, '').replace(/^Prompt:\s*/i, '').replace(/"/g, '');

        // Step B: Generate the image
        const generateImage = async (modelName: string) => {
            // Use tools for Pro model if in textbook mode (grounding)
            const useTools = (modelName.includes('pro') && mode === 'textbook');
            const tools = useTools ? [{ googleSearch: {} }] : undefined;

            return await ai.models.generateContent({
                model: modelName,
                contents: { parts: [{ text: enhancedPrompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: "4:3",
                    },
                    tools: tools
                }
            });
        };

        let imageResponse;
        try {
            // For 'textbook' mode, prioritize Pro + Search. For 'ai' mode, we can try Pro for quality or Flash.
            // Let's default to Pro for quality in both cases if possible, falling back to Flash.
            imageResponse = await generateImage('gemini-3-pro-image-preview');
        } catch (e: any) {
             const errStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
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
};

export const searchMedicalTerm = async (
  apiKey: string,
  term: string,
  language: Language,
  imageMode: ImageMode = 'textbook'
): Promise<Partial<SearchResult>> => {
  const ai = getClient(apiKey);
  
  // Enforce output language based on the UI setting, not the input term language
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
    const textPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const imagePromise = generateMedicalIllustration(apiKey, term, imageMode);

    const [textResponse, imageUrl] = await Promise.all([textPromise, imagePromise]);

    const explanation = textResponse.text || (language === 'ar' ? "لم يتم العثور على شرح." : "No explanation found.");
    
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
