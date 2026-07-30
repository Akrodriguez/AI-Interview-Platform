require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function main() {
    const models = await genAI.listModels();

    models.forEach((model) => {
        console.log(model.name);
    });
}

main().catch(console.error);