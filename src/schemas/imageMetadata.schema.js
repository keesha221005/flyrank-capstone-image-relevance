const { z } = require('zod');

const ImageMetadataSchema = z.object({
  subject: z.string().min(1),
  category: z.enum([
    'animal',
    'nature',
    'people',
    'object',
    'other'
  ]),
  attributes: z.array(z.string()).min(1).max(8),
  caption: z.string().min(10),
  confidence: z.number().min(0).max(1)
});

module.exports = { ImageMetadataSchema };