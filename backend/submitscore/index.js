const serverless = require('serverless-http');
const express = require('express')
const app = express();

const axios = require('axios');

var cors = require('cors');

let corsOptions = {
    origin: '',
    credentials: true
}
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const firebase_admin = require('firebase-admin');
const serviceAccount = require(''); // Download .json file

firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert(serviceAccount),
});

app.post('/submit_score', async (req, res) => {
    try {
        const { name, userscore, messages, evaluationA, evaluationB, leaderboard_A_or_B } = req.body;
        
        const leaderboardRef = firebase_admin.firestore().collection(leaderboard_A_or_B);
        if (leaderboard_A_or_B === "woshiai_leaderboard_a"){
            await leaderboardRef.add({
                name,
                userscore,
                messages,
                evaluationA,
                evaluationB,
                timestamp: firebase_admin.firestore.FieldValue.serverTimestamp()
            });
        } else if (leaderboard_A_or_B === "woshiai_leaderboard_b"){
            await leaderboardRef.add({
                name,
                userscore,
                messages,
                evaluationA,
                timestamp: firebase_admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.status(200).json({ message: 'Score submitted successfully' });
    } catch (error) {
        console.error('Error submitting score to Firestore: ', error);
        res.status(500).json({ message: 'Error submitting score' });
    }
});

module.exports.handler = serverless(app);
// app.listen(3002);
