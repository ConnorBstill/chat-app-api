import express, { Request, Response } from 'express';
import { Server } from 'ws';
import cors from 'cors';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
require('dotenv').config();

import { responseBuilder } from './utils/responseBuilder';

const app = express();
const port = 8080; // default port to listen
const sockserver = new Server({ port: 443 });

// interface Res extends Response {
//     db: any
// }

const corsOptions = {
   origin: '*', 
   credentials: true,            //access-control-allow-credentials:true
   optionSuccessStatus: 200,
}

console.log({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

app.use(cors(corsOptions));

app.use(bodyParser.json())

app.use(async (req: any, res, next) => {
    try {
        req.db = await pool.getConnection();
        req.db.connection.config.namedPlaceholders = true;
    
        // Traditional mode ensures not null is respected for unsupplied fields, ensures valid JavaScript dates, etc.
        await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
        await req.db.query(`SET time_zone = '-8:00'`);
    
        await next();
    
        req.db.release();
      } catch (err) {
        // If anything downstream throw an error, we must release the connection allocated for the request
        console.log(err)
        if (req.db) req.db.release();
        throw err;
      }
})

// define a route handler for the default home page

// app.use((req, res) => res.json({ data: 'DATAAA' }));

// sockserver.on('connection', (ws) => {
//     console.log('New client connected!'); 
//     ws.on('close', () => console.log('Client has disconnected!'));
// });
app.post('/register', async function (req: any, res) {
  try {
    let encodedUser;
    // Hashes the password and inserts the info into the `user` table
    await bcrypt.hash(req.body.password, 10).then(async hash => {
      try {
        const [user] = await req.db.query(`
          INSERT INTO user (user_name, password)
          VALUES (:userName, :password);
        `, {
          // email: req.body.email,
          // fname: req.body.fname,
          // lname: req.body.lname,
          userName: req.body.userName,
          password: hash
        });

        encodedUser = jwt.sign(
          { 
            userId: user.insertId,
            ...req.body
          },
          process.env.JWT_KEY
        );
      } catch (error) {
        console.log('error', error);
      }
    });


    res.json(encodedUser);
  } catch (err) {
    console.log('err', err)
  }
});

app.post('/authenticate', async function (req: any, res) {
  try {
    const { userName, password } = req.body;

    const [[user]] = await req.db.query(`
      SELECT * FROM user WHERE user_name = :userName
    `, {  userName });

    if (!user) res.json('Email not found');

    console.log('user', user)

    const dbPassword = `${user.password}`

    console.log('dbPassword', dbPassword);

    const compare = await bcrypt.compare(password, dbPassword);

    console.log('compare', compare);

    if (compare) {
      const payload = {
        userId: user.id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        role: 4
      }
      
      const encodedUser = jwt.sign(payload, process.env.JWT_KEY);

      res.json(encodedUser)
    }
    
    res.json('Password not found');
    
  } catch (err) {
    console.log('Error in /auth', err)
  }
});

app.get('/last-messages', (req: Request, res: Response) => {
    try {
        const messages = [
            {
                body: 'Want to see a movie friday?',
                from: 'John',
                date: '2022-12-01T19:24:59.210Z'
            },
            {
                body: 'The new Prime password is password123456',
                from: 'The Mom',
                date: '2022-12-01T19:24:59.210Z'
            },
            {
                body: "Yeah you should get Scarlet if she's getting Violet",
                from: 'Jarrod',
                date: '2022-12-01T19:24:59.210Z'
            },
            {
                body: 'Ok',
                from: 'The Dad',
                date: '2022-12-01T19:24:59.210Z'
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
