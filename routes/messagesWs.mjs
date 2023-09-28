import express from 'express';
import asyncHandler from 'express-async-handler'
import MessagesService from '../service/MessagesService.mjs';
import { validate } from "../middleware/validation.mjs";
import config from 'config'
import authVerification from "../middleware/authVerification.mjs";
import Joi from 'joi'
import valid from '../middleware/valid.mjs';
import ChatRoom from '../service/ChatRoom.mjs';
import { usersService } from './users.mjs';


export const messages = express.Router();
export const chatRoom = new ChatRoom();
export const messagesService = new MessagesService();

const {minId, maxId, minDate, maxDate, departments, minSalary, maxSalary} = config.get('employee');
const schema = Joi.object({
    id: Joi.string(),
    text: Joi.string().required(),
    from: Joi.string().required(),
    to: Joi.string().required(),
    dateTime: Joi.date().required(),
    readByRecepient: Joi.number().valid(0, 1).required()
})
messages.use(validate(schema));
messages.delete('/:id', authVerification("ADMIN"), asyncHandler(
    async (req, res) => {
        const id = +req.params.id;
        if (!await messagesService.deleteMessage(id)){
            res.status(404);
            throw `message with id ${id} not found`
        }
        if(req.wss) {
            req.wss.clients.forEach(c => c.send(JSON.stringify({op:'delete', data: id})))
        }
        res.send();
    }
))

messages.post('',authVerification("ADMIN","USER"), valid, asyncHandler(
    async (req, res) => {

        const message = await messagesService.addMessage(req.body);
        if (!message && req.body.id) {
            res.status(400);
            throw `message with id ${req.body.id} already exists`
        }
        if(req.wss) {
           req.wss.clients.forEach(c => c.send(JSON.stringify({op:'add', data:message})))
           
        }
        res.send(message);
    }
))
messages.put('/:id',authVerification("ADMIN","USER"),valid, asyncHandler(
    async (req, res) => {
      
        if (req.params.id != req.body.id) {
            res.status(400);
            throw `id in request parameter (${req.params.id}) doesn't match the id in message object (req.body.id)`
        }
        const message = await messagesService.updateMessage(req.body);
        if (!message) {
            res.status(404);
            throw `message with id ${req.body.id} doesn't exist`
        }
        if(req.wss) {
            req.wss.clients.forEach(c => c.send(JSON.stringify({op:'update', data:message})))
        }
        res.send(message);
    }
))

 messages.get('', authVerification("ADMIN", "USER"),asyncHandler(
    async(req,res) => {
        const messages = await messagesService.getAllMessages();
        res.send(messages);
    }
))
messages.get('/:id',authVerification("ADMIN", "USER"), asyncHandler(
   async (req, res) => {
    const message = await messagesService.getMessage(+req.params.id);
    if (!message) {
        res.status(404);
        throw `message with id ${req.params.id} doesn't exist`
    }
    res.send(message)
   } 
))
messages.get('/from/:sendername/to/:recepientname', authVerification("ADMIN", "USER"),asyncHandler(
    async(req,res) => {
        const messages = await messagesService.getIncomingMessages(req.params.sendername, req.params.recepientname);
        res.send(messages);
    }
))
messages.get('/contacts', (req, res) => {
    res.send(chatRoom.getClients());
});
messages.ws('/websocket/:clientName', async (ws, req) => {
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
