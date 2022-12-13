import express, { Request, Response } from 'express';
import { Server } from 'ws';
import cors from 'cors';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

require('dotenv').config();

import { responseBuilder } from './utils/responseBuilder';
import { encode } from 'punycode';

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

app.use(bodyParser.json());

app.use(cookieParser());

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
    console.log('req.body', req.body)
    // Hashes the password and inserts the info into the `user` table
    await bcrypt.hash(req.body.password, 10).then(async hash => {
      try {
        const [user] = await req.db.query(`
          INSERT INTO user (user_name, password)
          VALUES (:username, :password);
        `, {
          // email: req.body.email,
          // fname: req.body.fname,
          // lname: req.body.lname,
          username: req.body.username,
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

    // res.cookie('user_jwt', `${encodedUser}`, {
    //   httpOnly: true
    // });

    res.json(responseBuilder({ jwt: encodedUser }, false));
  } catch (err) {
    console.log('err', err);
    res.json(responseBuilder(null, true));
  }
});

app.post('/authenticate', async function (req: any, res) {
  try {
    console.log('ONE')
    const { username, password } = req.body;
    const [[user]] = await req.db.query(`SELECT * FROM user WHERE user_name = :username`, {  username });

    if (!user) res.json('Email not found');
    console.log('TWO')
    const dbPassword = `${user.password}`
    const compare = await bcrypt.compare(password, dbPassword);

    if (compare) {
      const payload = {
        userId: user.id,
        username: user.username,
      }
      
      const encodedUser = jwt.sign(payload, process.env.JWT_KEY);

      res.json(responseBuilder({ jwt: encodedUser }, false));
    } else {
      res.json('Password not found');
    }
    console.log('THREE')
    
  } catch (err) {
    console.log('Error in /authenticate', err)
  }
});

// Jwt verification checks to see if there is an authorization header with a valid jwt in it.
app.use(async function verifyJwt(req: any, res, next) {
  if (!req.headers.authorization) {
    res.json('Invalid authorization, no authorization headers');
  }

  const [scheme, token] = req.headers.authorization.split(' ');

  if (scheme !== 'Bearer') {
    res.json('Invalid authorization, invalid authorization scheme');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_KEY);
    req.user = payload;
  } catch (err) {
    console.log(err);
    if (
      err.message && 
      (err.message.toUpperCase() === 'INVALID TOKEN' || 
      err.message.toUpperCase() === 'JWT EXPIRED')
    ) {

      req.status = err.status || 500;
      req.body = err.message;
      req.app.emit('jwt-error', err, req);
    } else {

      throw((err.status || 500), err.message);
    }
  }

  await next();
});

app.get('/last-messages', async (req: any, res: Response) => {
  try {
    const [lastMessages] = await req.db.query(`
      SELECT messages.*, u.user_name AS from_user FROM messages,  
      (
        SELECT from_user_id, max(date_time) AS date_time FROM messages GROUP BY from_user_id
      ) last_message

      INNER JOIN user u ON last_message.from_user_id = u.id
      WHERE messages.from_user_id = last_message.from_user_id
      AND messages.date_time = last_message.date_time
      AND messages.to_user_id = :userId
    `, { userId: req.user.userId });
  
      res.json(responseBuilder(lastMessages, false));
  } catch (err) {
    console.log(err)
      res.json(responseBuilder(null, true));
  }
});

// start the Express server
app.listen(port, () => {
    console.log( `server started at http://localhost:${port}`);
});
