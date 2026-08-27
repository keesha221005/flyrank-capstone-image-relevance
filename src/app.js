// src/app.js
require('dotenv').config();
const express = require('express');

const postsRoutes = require('./routes/posts.routes');
const imagesRoutes = require('./routes/images.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const costsRoutes = require('./routes/costs.routes');

const app = express();
app.use(express.json());

app.use('/api/posts', postsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/costs', costsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));