const axios = require('axios');

/**
 * Converts text to an audio buffer using ElevenLabs.
 * @param {string} text - The text to be spoken.
 * @returns {Promise<Buffer>} - The raw audio buffer.
 */
async function generateAudioBuffer(text) {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID; 

    // The API endpoint for Text-to-Speech
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;

    try {
        const response = await axios.post(
            url,
            {
                text: text,
                // CRITICAL: This model supports 29 languages and auto-detects them
                model_id: "eleven_multilingual_v2", 
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                // CRITICAL: We tell axios we want raw binary data, not JSON
                responseType: 'arraybuffer' 
            }
        );

        // Return the binary data as a Node Buffer
        return Buffer.from(response.data);

    } catch (error) {
        console.error("❌ ElevenLabs API Error:", error.response?.data || error.message);
        throw new Error("Failed to generate audio.");
    }
}

module.exports = { generateAudioBuffer };