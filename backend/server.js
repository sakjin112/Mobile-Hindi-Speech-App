const express = require("express");
const cors = require("cors");
require('dotenv').config();
const { OpenAI } = require("openai");

const app = express();
const PORT = process.env.PORT || 3001;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// CORS configuration for mobile app
app.use(cors({
    origin: ['http://localhost:19006', 'http://localhost:8081', '*'], // Expo dev servers
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ message: "Hindi Voice Assistant Backend is running!" });
});

// Chat endpoint
app.post("/chat", async(req, res) => {
    try {
        const { message } = req.body;
        
        console.log("Received message:", message);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", 
            messages: [
                {
                    role: "system", 
                    content: "आप एक सहायक हैं जो हिंदी में उत्तर देते हैं। कृपया पूरा और विस्तृत उत्तर दें। अपने उत्तर को बीच में न काटें।"
                }, 
                {
                    role: "user", 
                    content: message
                }
            ], 
            max_tokens: 1000
        });

        const aiResponse = completion.choices[0].message.content;
        console.log("AI Response:", aiResponse);

        res.json({ response: aiResponse });
    } catch (error) {
        console.log("Error: ", error);
        res.status(500).json({response: 'माफ करें, कुछ गलत हुआ है।'});
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Mobile AI Backend running on port ${PORT}`);
    console.log(`📱 Ready for mobile app connections`);
});