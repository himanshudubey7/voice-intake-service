require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const FoodListing = require('./models/Foodlisting');
const { extractDonationData } = require('./services/geminiExtractor');
const { generateAudioBuffer } = require('./services/elevenlabs'); // Copy this from your chatbot

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// --- SESSION MEMORY ---
// This stores partial data for users while they are talking to the bot
const userSessions = new Map(); 

io.on('connection', (socket) => {
  console.log(`🔌 Donor connected: ${socket.id}`);
  
  // Initialize a blank form for this user
  userSessions.set(socket.id, {});

  socket.on('start_intake', async (payload) => {
    // 1. Extract preferredLanguage from the incoming payload
    const { userMessage, donorId, preferredLanguage } = payload; 
    let currentData = userSessions.get(socket.id);

    try {
      // 2. Pass it into the Gemini Extractor
      const aiState = await extractDonationData(userMessage, currentData, preferredLanguage);
      
      // 2. Update our server's memory with whatever new info Gemini found
      userSessions.set(socket.id, aiState.extractedData);
      
      // 3. Send text response instantly
      socket.emit('intake_text_reply', { text: aiState.aiReply });

      // 4. Send audio response
      try {
        const audioBuffer = await generateAudioBuffer(aiState.aiReply);
        socket.emit('intake_audio_reply', { audio: audioBuffer });
      } catch (err) {
        console.log("Audio failed, text delivered.");
      }

      // 5. IF COMPLETE -> SAVE TO MONGODB
      if (aiState.isComplete) {
        const finalData = aiState.extractedData;
        
        // Calculate the expiry Date object
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + (finalData.expiryHours || 2));

        const newListing = new FoodListing({
          donorId: donorId || new mongoose.Types.ObjectId(), // Use actual user ID in production
          title: finalData.title,
          quantity: finalData.quantity,
          unit: finalData.unit || 'servings',
          category: finalData.category,
          condition: finalData.condition || 'fresh',
          address: finalData.address,
          expiryAt: expiryDate
        });

        await newListing.save();
        console.log("✅ New Food Listing Saved to Database!");
        
        // Clear the session so they can make a new donation
        userSessions.set(socket.id, {});
      }

    } catch (error) {
      console.error("Intake Error:", error);
      socket.emit('intake_error', { message: "Sorry, let's try that again." });
    }
  });

  socket.on('disconnect', () => {
    // Clean up memory when they leave the app
    userSessions.delete(socket.id);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`🚀 Voice Intake Microservice running on port ${process.env.PORT}`);
});