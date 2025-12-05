const fetch = require('node-fetch');

const GEMINI_API_KEY = '***REMOVED***';

async function testModelDirect(modelName) {
    console.log(`\n🧪 Testing model: ${modelName} (Direct API)`);
    console.log('━'.repeat(50));

    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Say hello in Spanish' }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.log('❌ FAILED');
            console.log('Status:', response.status);
            console.log('Error:', error);
            return false;
        }

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;

        console.log('✅ SUCCESS!');
        console.log('Response:', text);
        return true;
    } catch (error) {
        console.log('❌ FAILED');
        console.log('Error:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Testing Gemini API Models (Direct v1 API)\n');

    const modelsToTest = [
        'gemini-pro',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
    ];

    const results = {};

    for (const model of modelsToTest) {
        results[model] = await testModelDirect(model);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 RESULTS SUMMARY');
    console.log('━'.repeat(50));
    for (const [model, success] of Object.entries(results)) {
        console.log(`${success ? '✅' : '❌'} ${model}`);
    }

    const workingModels = Object.entries(results)
        .filter(([_, success]) => success)
        .map(([model]) => model);

    if (workingModels.length > 0) {
        console.log(`\n✨ Working models: ${workingModels.join(', ')}`);
        console.log(`\n💡 Use this model: "${workingModels[0]}"`);
    } else {
        console.log('\n⚠️  No models worked. API key may be invalid or restricted.');
    }
}

main().catch(console.error);
