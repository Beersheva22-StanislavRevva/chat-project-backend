import express from 'express'
import asyncHandler from 'express-async-handler'
import Joi from 'joi'
import { validate } from '../middleware/validation.mjs';
import UsersService from '../service/UsersService.mjs';
import authVerification from '../middleware/authVerification.mjs';
import valid from '../middleware/valid.mjs';
export const users = express.Router();
const usersService = new UsersService()
const schema = Joi.object({
    username: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    roles: Joi.array().items(Joi.string().valid('ADMIN', 'USER')).required()
})
users.use(validate(schema))
users.post('', authVerification("ADMIN_ACCOUNTS"), valid,  asyncHandler(async (req, res) => {
    
    const accountRes = await usersService.addAccount(req.body);
    if (accountRes == null) {
        res.status(400);
        throw `account ${req.body.username} already exists`
    }
     res.status(201).send(accountRes);
  
}));
users.get("/:username",authVerification("ADMIN_ACCOUNTS", "ADMIN", "USER"), asyncHandler(
    async (req,res) => {
        const username = req.params.username;
      
        const account = await usersService.getAccount(username);
        if (!account) {
            res.status(404);
            throw `account ${username} notfound`
        }
        res.send(account);
    }
));
users.post("/login", asyncHandler(
    async (req, res) => {
        const loginData = req.body;
        const accessToken = await usersService.login(loginData);
        if (!accessToken) {
            res.status(400);
            throw 'Wrong credentials'
        }
        res.send({accessToken});
    }
))
