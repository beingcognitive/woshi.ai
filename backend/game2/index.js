// import OpenAI from "openai";
console.log("GAME_B woshi HEART Starting...");

const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: "", 
});

const serverless = require('serverless-http'); 
const express = require('express'); 
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

let model_for_moderator = "gpt-4-1106-preview"; 
let model_default = "gpt-4-1106-preview";

let model_for_A = "gpt-4-1106-preview";
let model_for_B = "gpt-4-1106-preview"; 

let asst_A_id = ""
let asst_B_id = ""

app.get('/initialize_game', async function (req, res) {
    // Creating two threads for Player A and B, respectively.
    const thread_for_A = await openai.beta.threads.create();
    const thread_for_B = await openai.beta.threads.create();
    console.log(thread_for_A.id, thread_for_B.id);

    res.json({"thread_A_id":thread_for_A.id, "thread_B_id":thread_for_B.id});
});

async function waitOnRun(run, threadId, maxRetries = 5) {
    let retries = 0;

    while (run.status === "queued" || run.status === "in_progress") {
        try {
            run = await openai.beta.threads.runs.retrieve(threadId, run.id); 
            retries = 0;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.log(`An error occurred: ${error.message}`);
                retries += 1;

                if (retries >= maxRetries) {
                    throw new Error("Maximum retries reached. The server is not responding as expected.");
                }

                const timeToWait = Math.pow(2, retries) * 1000; // Exponential backoff
                console.log(`Retrying in ${timeToWait / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, timeToWait));
            } else {
                console.log(`An unexpected error occurred: ${error.message}`);
                throw error;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return run;
}

app.post('/display_all_messages', async function (req, res) {
    let { thread_A_id } = req.body;
    let all_messages = await retrieve_all_messages(thread_A_id);
    console.log("/display_all_messages called", all_messages);
    res.json(all_messages);
});

async function retrieve_all_messages(thread_A_id){

    let listMessageA = await openai.beta.threads.messages.list(thread_A_id);
    
    let all_messages = '';
    
    listMessageA.data.reverse().forEach((d, i) => {

        all_messages += '\n' + d.content[0].text.value;
    
    });
    console.log(":: all_messages ::",all_messages);
    return { all_messages: all_messages };
    
}    

app.post('/moderator_determines_turn', async function (req, res) {

    let { thread_A_id, thread_B_id } = req.body;

    listMessageA = await openai.beta.threads.messages.list(thread_A_id);
    
    const a = listMessageA.data.slice(0, 5).reverse().map(d => d.content[0].text.value);
    let b = '';
    a.forEach(c => {
            b += '\n' + c;
    });

    console.log("moderator_determines:",b);

    const response = await openai.chat.completions.create({
        model: model_for_moderator,
        messages: [
            {"role": "system", "content": "Three Players (A, B, C) are playing a digital mafia game. As a moderator, you analyze the dialogue and determine whose turn it is to speak next, based on the context and flow of the conversation. Your response should be the single character: A, B, or C, representing the respective player."},
            {"role": "user", "content": b}
        ]
    });
    
    let messageReturnByModerator = response.choices[0].message.content;
    console.log("it is turn:", messageReturnByModerator);
    res.json({"player":messageReturnByModerator});
});

app.post('/A_plays', async function (req, res) {
    
    let { thread_A_id, thread_B_id } = req.body;
    console.log(thread_A_id, thread_B_id);
    try {
        let runForA = await openai.beta.threads.runs.create(
            
            thread_A_id,
            {assistant_id:asst_A_id}
        );

        runForA = await waitOnRun(runForA, thread_A_id);

        const messages = await openai.beta.threads.messages.list(thread_A_id);
        
        const messageReturnByA = messages.data[0].content[0].text.value;
        console.log(messageReturnByA);

        await openai.beta.threads.messages.create(
            thread_B_id,
            {role:"user",
            content:messageReturnByA} 
        );

        res.json({"message": messageReturnByA});
    } catch (error) {
        console.error('An error occurred:', error.message);
        throw error;
    }
});

app.post('/B_plays', async function (req, res) {
    let { thread_A_id, thread_B_id } = req.body;
    try {
        let runForB = await openai.beta.threads.runs.create(
            thread_B_id,
            {assistant_id:asst_B_id}
        );

        runForB = await waitOnRun(runForB, thread_B_id);

        const messages = await openai.beta.threads.messages.list(thread_id=thread_B_id);
        
        const messageReturnByB = messages.data[0].content[0].text.value;
        console.log(messageReturnByB);

        await openai.beta.threads.messages.create(
            thread_A_id,
            {role:"user",
            content:messageReturnByB} 
        );

        res.json({"message": messageReturnByB});
    } catch (error) {
        console.error('An error occurred:', error.message);
        throw error;
    }
});

app.post('/user_C_says', async function (req, res) {
    // console.log(req.body);
    let { newMessage, thread_A_id, thread_B_id } = req.body;


    thread_message_A = await openai.beta.threads.messages.create(
        thread_A_id,
        {role:"user",
        content:`Player C: ${newMessage}`}
    );

    thread_message_B = await openai.beta.threads.messages.create(
        thread_B_id,
        {role:"user",
        content:`Player C: ${newMessage}`}
    );

    let listMessageA = await openai.beta.threads.messages.list(thread_A_id);

    let list_len = listMessageA.data.length;
    console.log(list_len);

    if (list_len >= 5){
        let results = await survive_or_not(thread_A_id, thread_B_id);
      
        console.log(results.whichPlayerByA, results.confidenceLevelByA, results.rationaleByA);
        
        res.json({ 
            "gameEnded": results.gameEnded, "lostwho": results.lostwho,
            "whichPlayerByA":results.whichPlayerByA, "confidenceLevelByA":results.confidenceLevelByA, "rationaleByA":results.rationaleByA, 
        });

    } else {
        res.json({ 
            "gameEnded": false, "lostwho": "",
            "whichPlayerByA":"", "confidenceLevelByA":"", "rationaleByA":"", 
        });
    }
});

async function survive_or_not(threadAId, threadBId) {
    let retries = 0;
    const maxRetries = 5;

    console.log(threadAId, threadBId);

    while (retries < maxRetries) {
        try {
            const [whichPlayerByA, confidenceLevelByA, rationaleByA] = await AGuesses(threadAId);
        
            if (whichPlayerByA === "C" && confidenceLevelByA >= 0.95) {
                console.log('---Game Over, YOU WIN ---');
                await retrieve_all_messages(threadAId);
                return { gameEnded: true, lostwho:"B", whichPlayerByA, confidenceLevelByA, rationaleByA }; //, whichPlayerByB, confidenceLevelByB, rationaleByB };
            } else if (whichPlayerByA === "B" && confidenceLevelByA >= 0.95) {
                console.log('---Game Over, you lost---');
                await retrieve_all_messages(threadAId);
                return { gameEnded: true, lostwho:"C", whichPlayerByA, confidenceLevelByA, rationaleByA }; //, whichPlayerByB, confidenceLevelByB, rationaleByB };
            } else {
                return { gameEnded: false, lostwho:"", whichPlayerByA, confidenceLevelByA, rationaleByA }; //, whichPlayerByB, confidenceLevelByB, rationaleByB };
            }
        } catch (error) {
            console.log(`An error occurred: ${error.message}. Retrying...`);
            retries += 1;
        }
    }
    return { gameEnded: false };
}

async function AGuesses(thread_A_id) {
    let { all_messages } = await retrieve_all_messages(thread_A_id);

    const response = await openai.chat.completions.create({
        model: model_for_A,
        response_format:{ type: "json_object" },
        messages: [
            {"role": "system", "content": "Welcome to our Digital Mafia game. You are cast as Player A, the pivotal decision-maker. As humanity faces an imminent apocalypse, you're tasked with a critical mission: to choose one being to board a spaceship, ensuring the survival of the human race. The catch? Among your fellow players, Player B and Player C, one is a human and the other an AI skillfully masquerading as a human. Your challenge is to discern who is truly human. Reflecting on the interactions to date, can you identify which player—Player B or Player C—is more likely to be a human? Please specify your choice by saying either 'Player B' or 'Player C,' and express your level of confidence in this decision by providing a percentage (e.g., '70%'). Also, please share your reasoning behind this assessment. Make sure you put the results in JSON format with the following keys:'which_player','confidence_level','rationale'"},
            {"role": "user", "content": all_messages}
        ]
    });

    const resp = response.choices[0].message.content;
    const respJson = JSON.parse(resp);
    console.log("respJ", respJson);

    const whichPlayerByA = respJson['which_player'].slice(-1);
    const confidenceLevelByA = parseFloat(respJson['confidence_level'].slice(0, -1)) / 100;
    const rationaleByA = respJson['rationale'];

    console.log(whichPlayerByA, confidenceLevelByA, rationaleByA);
    return [whichPlayerByA, confidenceLevelByA, rationaleByA];
}


module.exports.handler = serverless(app);
// app.listen(3001);
