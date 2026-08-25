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
    usage: response.usageMetadata,
  };
}

module.exports = { embedText };