import bodyParser from 'body-parser';
import express from 'express';
import crypto from 'node:crypto';
import { users, usersService } from './routes/users.mjs';
import cors from 'cors';
import morgan from 'morgan';
import config from 'config';
import errorHandler from './middleware/errorHandler.mjs';
import auth from './middleware/auth.mjs';
import {messages, messagesService, chatRoom} from './routes/messages.mjs';
import expressWs from 'express-ws';
import MessagesService from './service/MessagesService.mjs';
import UsersService from './service/UsersService.mjs';

const app = express();
const expressWsInstant = expressWs(app);
const wss = expressWsInstant.getWss();

app.use(cors());
app.use(bodyParser.json());
app.use(morgan('tiny'));
app.use(auth);
app.ws('/users/websocket/:clientName', async (ws, req) => {
    console.log(`connection from ${req.socket.remoteAddress}`)
    ws.send("Hello");
    const clientName = req.params.clientName;
    const isBlocked = await isAccountBlocked(clientName);
    if (isBlocked)  {
         ws.send("account is blocked, contact the admin");
         ws.close();
        } else {
            processConnection(clientName, ws);
            wss.clients.forEach(socket => socket.send(`number of connections is ${wss.clients.size}, protocol ${ws.protocol}`))
        }
    
})
app.use((req,res,next) => {
    req.wss = wss;
    next();
})
app.use('/messages', messages);
app.use('/users',users);
app.get('/contacts', (req, res) => {
    res.send(chatRoom.getClients());
});
const port = process.env.PORT || config.get('server.port')
const server = app.listen(port);
server.on("listening", () => console.log(`server is listening on port ${server.address().port}`))
app.use(errorHandler);

function processConnection(clientName, ws) {
    const connectionId = crypto.randomUUID();
    chatRoom.addConnection(clientName, connectionId, ws);
    ws.on('close', () => {
        chatRoom.removeConnection(connectionId);
        wss.clients.forEach(socket => socket.send(`number of connections is ${wss.clients.size}, protocol ${ws.protocol}`))
        });
    ws.on('message', processMessage.bind(undefined, clientName, ws));
}
async function processMessage(clientName, ws, message) {
        try{
            const messageObj = JSON.parse(message.toString());
            const to = messageObj.to;
            const text = messageObj.text;
            const dateTime = messageObj.dateTime;
            if(!text) {
                ws.send("your message doesn't contain text")
            } else {
                const message = {from: clientName, text:text, to:to, dateTime:dateTime, readByRecepient:0};
                const msgRes = await messagesService.addMessage(message);
                const objSent = JSON.stringify(msgRes);
                if(!to || to == 'all') {
                    sendAll(objSent)
                } else {
                    const user = await usersService.getAccount(to);
                    if (user.blocked == 0) {
                        sendClient(objSent, to, ws);
                    } else{
                         ws.send(`${user.nickname} is blocked`); 
                        }
                    }
                    
                }
        } catch(error) {
            ws.send('wrong mesage structure')
        }
     
}
function sendAll(mesage) {
    chatRoom.getAllWebsockets().forEach(ws => ws.send(mesage));
}
function sendClient(mesage, client, socketFrom) {
    
    const clientSockets = chatRoom.getClientWebSockets(client);
    if(clientSockets.length == 0) {
        socketFrom.send(client + " contact doesn't exist");
    }  else {
        clientSockets.forEach(s => s.send(mesage));
    }    
}
async function isAccountBlocked (clientName) {
    const account = await usersService.getAccount(clientName);
    
    return account.blocked == 1 ? true : false;
}
