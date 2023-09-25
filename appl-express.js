import bodyParser from 'body-parser';
import express from 'express';
import crypto from 'node:crypto';
import { users } from './routes/users.mjs';
import cors from 'cors';
import morgan from 'morgan';
import config from 'config';
import errorHandler from './middleware/errorHandler.mjs';
import auth from './middleware/auth.mjs';
import {messages } from './routes/messages.mjs';
import expressWs from 'express-ws';
import ChatRoom from './service/ChatRoom.mjs'
import MessagesService from './service/MessagesService.mjs';
import UsersService from './service/UsersService.mjs';

const app = express();
const expressWsInstant = expressWs(app);
const wss = expressWsInstant.getWss();
const chatRoom = new ChatRoom();
const messagesService = new MessagesService();
const usersService = new UsersService();

app.use(cors());
app.use(bodyParser.json());
app.use(morgan('tiny'));
app.use(auth);
app.ws('/messages/websocket/:clientName', async (ws, req) => {
    console.log(`connection from ${req.socket.remoteAddress}`)
    ws.send("Hello");
    wss.clients.forEach(socket => socket.send(`number of connections is ${wss.clients.size}, protocol ${ws.protocol}`))
    const clientName = req.params.clientName;
    const isExists = await isAccountExist(clientName);
    if (!isExists)  {
         ws.send("sender account does not exist ");
         ws.close();
        } else {
            processConnection(clientName, ws);
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
// app.ws('/contacts/websocket/', (ws, req) => {
//     const clientName = ws.protocol || req.query.clientName;
//     if (!clientName) {
//         ws.send('must be client name');
//         ws.close();
//     } else {
//         processConnection(clientName, ws);
//     }
// });
// app.ws('/contacts/websocket/:clientName', (ws, req) => {
//         const clientName = req.params.clientName;
//          if (!usersService.getAccount(clientName)) {
//             ws.send("sender account does not exist ")
//          } else {
//             processConnection(clientName, ws);
//         }
//     }
// );
const port = process.env.PORT || config.get('server.port')
const server = app.listen(port);
server.on("listening", () => console.log(`server is listening on port ${server.address().port}`))
app.use(errorHandler);

function processConnection(clientName, ws) {
    const connectionId = crypto.randomUUID();
    chatRoom.addConnection(clientName, connectionId, ws);
    const online = usersService.setOnline(clientName, 1);
    ws.on('close', () => {
        chatRoom.removeConnection(connectionId)
        const offline = usersService.setOnline(clientName, 0)
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
                    if (user.active == 1 && user.blocked == 0){
                        sendClient(objSent, to, ws);
                    } else{
                         user.blocked == 0 ? ws.send(`${user.nickname} is unactive`) : ws.send(`${user.nickname} is blocked`); 
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
async function isAccountExist (clientName) {
    const res = await usersService.getAccount(clientName);
    return res == null ? false : true;
}
async function isBlocked(clientName) {
    const res = await usersService.getAccount(clientName);
    return res.blocked == 0 ? false : true;
}
async function isActive(clientName) {
    const res = await usersService.getAccount(clientName);
    return res.active == 0 ? false : true;
}