const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('GROQ_API_KEY not found in .env.local');
        return;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Error fetching models:', error);
            return;
        }

        const data = await response.json();
        console.log('Available Groq Models:');
        data.data.forEach(model => {
            console.log(`- ${model.id}`);
        });
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

listModels();
