import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, ProviderSettings } from "@/lib/types";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface GenerateOptions {
  settings: ProviderSettings;
  messages: ChatMessage[];
  temperature?: number;
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const { settings } = options;
  switch (settings.provider) {
    case "ollama":
      return generateWithOllama(options);
    case "groq":
      return generateWithGroq(options);
    case "gemini":
      return generateWithGemini(options);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}

async function generateWithOllama(options: GenerateOptions): Promise<string> {
  const { settings, messages, temperature = 0.8 } = options;
  const baseUrl = settings.ollamaBaseUrl.replace(/\/$/, "");

  // Ollama chat format: system prompt is separate, then messages
  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model || "llama3.2",
      messages: systemMessage
        ? [{ role: "system", content: systemMessage }, ...chatMessages]
        : chatMessages,
      stream: false,
      options: { temperature },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama error (${res.status}): ${text || res.statusText}. Make sure Ollama is running and CORS is enabled with OLLAMA_ORIGINS=*`
    );
  }

  const data = await res.json();
  return data.message?.content?.trim() || "";
}

async function generateWithGroq(options: GenerateOptions): Promise<string> {
  const { settings, messages, temperature = 0.8 } = options;
  if (!settings.groqApiKey) {
    throw new Error("Groq API key is required. Add it in the provider settings.");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.groqApiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "llama-3.1-8b-instant",
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq error (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateWithGemini(options: GenerateOptions): Promise<string> {
  const { settings, messages, temperature = 0.8 } = options;
  if (!settings.geminiApiKey) {
    throw new Error(
      "Gemini API key is required. Get one from Google AI Studio and add it in the provider settings."
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(settings.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: settings.model || "gemini-3.5-flash",
    });

    const systemMessage = messages.find((m) => m.role === "system")?.content || "";
    const userMessage = messages.find((m) => m.role === "user")?.content || "";

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: systemMessage,
      generationConfig: { temperature },
    });

    return result.response.text()?.trim() || "";
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("API key not valid")) {
        throw new Error("Your Gemini API key is invalid. Please check it in AI Provider settings.");
      }
      if (err.message.includes("not found") || err.message.includes("models/")) {
        throw new Error(`Gemini model "${settings.model}" is not available. Pick a different model in AI Provider settings.`);
      }
      throw new Error(`Gemini error: ${err.message}`);
    }
    throw err;
  }
}

export function getProviderModels(provider: AIProvider): { value: string; label: string }[] {
  switch (provider) {
    case "ollama":
      return [
        { value: "llama3.2", label: "Llama 3.2" },
        { value: "llama3.1", label: "Llama 3.1" },
        { value: "mistral", label: "Mistral" },
        { value: "phi4", label: "Phi-4" },
        { value: "qwen2.5", label: "Qwen 2.5" },
      ];
    case "groq":
      return [
        { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
        { value: "llama-3.3-70b-specdec", label: "Llama 3.3 70B SpecDec" },
        { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B" },
        { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
        { value: "llama-3.2-3b-preview", label: "Llama 3.2 3B" },
        { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
        { value: "qwen-2.5-32b", label: "Qwen 2.5 32B" },
        { value: "qwen-2.5-coder-32b", label: "Qwen 2.5 Coder 32B" },
        { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill" },
      ];
    case "gemini":
      return [
        { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
        { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
        { value: "gemini-3.1-flash", label: "Gemini 3.1 Flash" },
        { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite Preview" },
        { value: "gemini-3-flash", label: "Gemini 3 Flash" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
        { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      ];
    default:
      return [];
  }
}

export function getDefaultModel(provider: AIProvider): string {
  return getProviderModels(provider)[0]?.value || "";
}
