const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const { LanguageServiceClient } = require('@google-cloud/language');
const path = require('path');
const fs = require('fs');

// Set Google Cloud credentials path
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join('/Users/ashleyrice/backend/credentials.json');

const app = express();
const port = 3000;

// Console log to verify credentials path
console.log('Using Google credentials from:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Check if credentials file exists
if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.error('WARNING: Credentials file not found at', process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        cb(null, 'recording-' + Date.now() + '.wav');
    }
});

const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Route to serve the correct index.html from the frontend folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Initialize Google Cloud clients
const speechClient = new SpeechClient();
const languageClient = new LanguageServiceClient();

// Test route to verify server is working
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working' });
});

// Upload route
app.post('/upload', upload.single('audio'), async (req, res) => {
    console.log('Received upload request');
    
    if (!req.file) {
        console.log('No file received');
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log('Processing file:', req.file.path);
        const filePath = req.file.path;
        const audioBytes = fs.readFileSync(filePath).toString('base64');

        const audio = { content: audioBytes };

        const config = {
            encoding: 'LINEAR16',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
        };

        console.log('Sending to Google Speech-to-Text');
        const [response] = await speechClient.recognize({ audio, config });

        if (!response.results || response.results.length === 0) {
            console.log('No speech detected');
            return res.status(200).json({
                transcript: '',
                message: 'No speech detected'
            });
        }

        const transcript = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        console.log('Transcript:', transcript);

        const document = { content: transcript, type: 'PLAIN_TEXT' };

        console.log('Performing sentiment analysis');
        const [sentimentResponse] = await languageClient.analyzeSentiment({ document });

        const result = {
            transcript,
            sentiment: {
                score: sentimentResponse.documentSentiment.score,
                magnitude: sentimentResponse.documentSentiment.magnitude
            }
        };

        console.log('Sending response:', result);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({
            error: 'Error processing audio',
            details: error.message
        });
    } finally {
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Server error',
        details: err.message
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Serving frontend from: ${path.join(__dirname, '../frontend')}`);
    console.log(`Uploads directory: ${uploadsDir}`);
});
