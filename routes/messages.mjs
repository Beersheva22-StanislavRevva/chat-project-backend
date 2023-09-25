import express from 'express';
import asyncHandler from 'express-async-handler'
import MessagesService from '../service/MessagesService.mjs';
import { validate } from "../middleware/validation.mjs";
import config from 'config'
import authVerification from "../middleware/authVerification.mjs";
import Joi from 'joi'
import valid from '../middleware/valid.mjs';
export const messages = express.Router();
const messagesService = new MessagesService();
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
