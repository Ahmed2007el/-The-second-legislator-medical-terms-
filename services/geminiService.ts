import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Language, SearchResult } from "../types";

// Helper to get client
const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;
  try {
    const ai = getClient(apiKey);
    // Simple lightweight check
    await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
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
    // 1. Get Text Explanation with Grounding
    const textResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const explanation = textResponse.text || (language === 'ar' ? "لم يتم العثور على شرح." : "No explanation found.");
    
    // Extract sources if available
    const sources = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((source: any) => source !== null) || [];

    // 2. Generate Illustration (Parallel or Sequential - Sequential safer for error handling)
    // Using gemini-3-pro-image-preview for high quality as requested
    let imageUrl: string | undefined = undefined;
    
    try {
        const imagePrompt = `A clean, scientific, educational medical illustration of: ${term}. White background, anatomical style.`;
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [{ text: imagePrompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "4:3",
                }
            }
        });

        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }
    } catch (imgError) {
        console.error("Image generation failed:", imgError);
        // We don't fail the whole request if image fails, just return text
    }

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
