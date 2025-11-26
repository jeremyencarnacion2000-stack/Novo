const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const XAI_API_KEY = process.env.XAI_API_KEY; // Clave API de xAI proporcionada

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-3',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ output: response.data.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating response' });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});