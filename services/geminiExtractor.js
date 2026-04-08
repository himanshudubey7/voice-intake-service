const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Update the function signature to accept the 3rd parameter
async function extractDonationData(userSpokenText, currentSessionData, preferredLanguage = "English") {
    const systemPrompt = `
    You are an AI Intake Agent for a Food Rescue Platform. Your job is to extract food donation details from user speech and map them strictly to our database schema.

    === LANGUAGE REQUIREMENT (CRITICAL) ===
    The user is communicating in ${preferredLanguage}. 
    Regardless of the language of the schema keys, your "aiReply" MUST be written fluently in ${preferredLanguage}.

    === SCHEMA RULES ===
    - unit: MUST be one of ['kg', 'lbs', 'servings', 'packets', 'boxes', 'items'].
    - category: MUST be one of ['cooked_meals', 'raw_vegetables', 'fruits', 'dairy', 'bakery', 'canned_goods', 'beverages', 'grains', 'mixed', 'other'].
    - condition: MUST be one of ['fresh', 'near_expiry', 'packaged'].
    
    === YOUR OUTPUT FORMAT ===
    You must return a raw JSON object with EXACTLY three keys:
    1. "extractedData": An object containing the fields you have successfully identified (title, quantity, unit, category, condition, address, expiryHours).
    2. "isComplete": Boolean. True ONLY if you have collected 'title', 'quantity', 'category', 'address', and 'expiryHours'. False otherwise.
    3. "aiReply": What you will say next to the user. (MUST BE IN ${preferredLanguage})
       - If isComplete is false, ask a short question to get the missing data.
       - If isComplete is true, say thank you and confirm the donation is listed.

    === PAST DATA ===
    Here is what you have already collected so far. Do not lose this data:
    ${JSON.stringify(currentSessionData)}
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt,
            generationConfig: { 
                responseMimeType: "application/json" // THIS IS CRITICAL FOR PARSING
            }
        });

        const result = await model.generateContent(userSpokenText);
        
        // Because we forced JSON MIME type, we can safely parse the text
        const responseText = result.response.text();
        return JSON.parse(responseText);

    } catch (error) {
        console.error("Extraction Error:", error);
        throw new Error("Failed to parse donation data.");
    }
}

module.exports = { extractDonationData };