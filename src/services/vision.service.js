// src/services/vision.service.js
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const { ImageMetadataSchema } = require('../schemas/imageMetadata.schema');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Mirrors the Zod schema, in Gemini's structured-output format
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    category: {
      type: Type.STRING,
      enum: ['animal', 'nature', 'people', 'object', 'other'],
    },
    attributes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: 8,
    },
    caption: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
  },
  required: ['subject', 'category', 'attributes', 'caption', 'confidence'],
};

async function classifyImage(imagePath) {
  const imageBytes = fs.readFileSync(imagePath);
  const base64Image = imageBytes.toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `Identify the main subject of this image and return structured data:
            - subject: a short canonical noun phrase, 1-2 words, singular (e.g. "red fox", "bear", "deer" — NOT "Two brown bears" or "Deer in a forest enclosure"). Describe WHAT it is, not how many or where.
            - category: one of animal, nature, people, object, other.
            - attributes: a list of descriptive tags (color, setting, behavior, etc.) — this is where descriptive detail belongs, not in subject.
            - caption: one full sentence describing the image.
            - confidence: your confidence (0-1) in this classification. Use the full range honestly — reserve 0.90+ for genuinely unambiguous cases, and score lower when the subject is partially obscured, unusual lighting, or could be confused with a similar species.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const rawText = response.text;
  const parsedJson = JSON.parse(rawText);

  // Never trust it blindly — validate against our own Zod schema too
  const validated = ImageMetadataSchema.parse(parsedJson);

  return {
    data: validated,
    usage: response.usageMetadata, // for cost tracking later
  };
}

module.exports = { classifyImage };