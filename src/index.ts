import express, { Request, Response } from 'express';
import { Server } from 'ws';
// const cors=require("cors");
import cors from 'cors';

import { responseBuilder } from './utils/responseBuilder';

const app = express();
const port = 8080; // default port to listen
const sockserver = new Server({ port: 443 });

const corsOptions = {
   origin: '*', 
   credentials: true,            //access-control-allow-credentials:true
   optionSuccessStatus: 200,
}

app.use(cors(corsOptions))

// define a route handler for the default home page

// app.use((req, res) => res.json({ data: 'DATAAA' }));

// sockserver.on('connection', (ws) => {
//     console.log('New client connected!'); 
//     ws.on('close', () => console.log('Client has disconnected!'));
// });

app.get('/last-messages', (req: any, res: any) => {
    try {
        const messages = [
            {
                body: 'Want to see a movie friday?',
                from: 'John',
                date: ''
            },
            {
                body: 'The new Prime password is password123456',
                from: 'The Mom',
                date: ''
            },
            {
                body: "Yeah you should get Scarlet if she's getting Violet",
                from: 'Jarrod',
                date: ''
            },
            {
                body: 'Ok',
                from: 'The Dad',
                date: ''
            }
        ];
    
        res.json(responseBuilder(messages, false));
    } catch (err) {
        res.json(responseBuilder(null, true));
    }
});

// start the Express server
app.listen(port, () => {
    console.log( `server started at http://localhost:${port}`);
});
