import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  try {
    const apiKey = "AIzaSyDdh3iyAJOp6CMh-VzEM0iJaEeK4R5fZ_s";
    console.log("API Key exists:", !!apiKey);
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log("Response:", response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
