const fetch = require('node-fetch');

const GEMINI_API_KEY = '***REMOVED***';

async function listModels() {
    console.log('🔍 Listing available Gemini models...\n');

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.text();
            console.log('❌ FAILED to list models');
            console.log('Status:', response.status);
            console.log('Error:', error);
            return;
        }

        const data = await response.json();

        if (!data.models || data.models.length === 0) {
            console.log('⚠️  No models available with this API key');
            return;
        }

        console.log(`✅ Found ${data.models.length} models:\n`);

        const generateContentModels = [];

        for (const model of data.models) {
            const supportsGenerate = model.supportedGenerationMethods?.includes('generateContent');
            const icon = supportsGenerate ? '✅' : '❌';

            console.log(`${icon} ${model.name}`);
            console.log(`   Display Name: ${model.displayName}`);
            console.log(`   Description: ${model.description}`);
            console.log(`   Methods: ${model.supportedGenerationMethods?.join(', ') || 'None'}`);
            console.log('');

            if (supportsGenerate) {
                generateContentModels.push(model.name);
            }
        }

        if (generateContentModels.length > 0) {
            console.log('\n✨ Models that support generateContent:');
            generateContentModels.forEach(name => console.log(`   - ${name}`));

            // Extract just the model ID (without "models/" prefix)
            const firstModel = generateContentModels[0].replace('models/', '');
            console.log(`\n💡 Use this in lib/gemini.ts: "${firstModel}"`);
        } else {
            console.log('\n⚠️  No models support generateContent with this API key');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

listModels();
