const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = '***REMOVED***';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function testModel(modelName) {
    console.log(`\n🧪 Testing model: ${modelName}`);
    console.log('━'.repeat(50));

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say hello in Spanish');
        const response = await result.response;
        const text = response.text();

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
    console.log('🚀 Testing Gemini API Models\n');

    const modelsToTest = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-pro-002',
        'gemini-1.5-flash',
        'gemini-1.5-flash-002',
        'gemini-pro',
    ];

    const results = {};

    for (const model of modelsToTest) {
        results[model] = await testModel(model);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
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
        console.log(`\n💡 Update lib/gemini.ts to use: "${workingModels[0]}"`);
    } else {
        console.log('\n⚠️  No models worked with this API key');
        console.log('Please check your API key or permissions at:');
        console.log('https://aistudio.google.com/app/apikey');
    }
}

main().catch(console.error);
