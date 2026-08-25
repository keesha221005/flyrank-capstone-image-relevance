// src/services/embedding.service.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function embedText(text) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      taskType: 'SEMANTIC_SIMILARITY',
    },
  });

  return {
    embedding: response.embeddings[0].values,
    // Embedding responses don't return usageMetadata the same way generateContent does —
    // approximate token count from input length as a reasonable estimate (~4 chars/token).
    estimatedTokens: Math.ceil(text.length / 4),
  };
}

module.exports = { embedText };