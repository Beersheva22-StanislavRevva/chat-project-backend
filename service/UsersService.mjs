import MongoConnection from '../domain/MongoConnection.mjs'
import bcrypt from 'bcrypt'
import config from 'config';
import jwt from "jsonwebtoken";
const MONGO_ENV_URI = 'mongodb.env_uri';
const MONGO_DB_NAME = 'mongodb.db';
const ENV_JWT_SECTRET = 'jwt.env_secret'

export default class UserService {
    #collection
    constructor() {
        const connection_string = process.env[config.get(MONGO_ENV_URI)];
        const dbName = config.get(MONGO_DB_NAME);
        const connection = new MongoConnection(connection_string, dbName);
        this.#collection = connection.getCollection('accounts');
    }
    async addAccount(account) {
       const accountDB = await toAccountDB(account);
       try{
            await this.#collection.insertOne(accountDB);
        }catch (error) {
            if(error.code == 11000) {
                account = null;
            } else {
                throw error;
            }
        }
             return account;
    }

    async getAccount(username) {
        const document = await this.#collection.findOne({_id:username});
        return document == null ? null : toAccount(document);
    }

    async login(loginData) {
        const account = await this.getAccount(loginData.username);
        let accessToken;
        if(account && await bcrypt.compare(loginData.password, account.passwordHash)) {
            accessToken = getJwt(account.username, account.roles);
        }
        return accessToken;
    }

    async setOnline(clientName, status) {
        const doc = await this.#collection.updateOne({_id: clientName},
            {$set:{active:status}});
        return doc.matchedCount == 1 ? clientName : null;
    }

    async setBlocked(clientName, status) {
        const doc = await this.#collection.updateOne({_id: clientName},
            {$set:{blocked:status}});
        return doc.matchedCount == 1 ? clientName : null;
    }

    async getMainGroup(type) {
        let conditions;
        let res;
        switch(type) {
            case 'online':
                conditions = [ {"active":1},{"blocked":0}]
                res = (await this.#collection.find({$and: conditions}).toArray()).map(toAccount);
                break;
            case 'offline':
                conditions = [ {"active":0},{"blocked":0}]
                res = (await this.#collection.find({$and: conditions}).toArray()).map(toAccount);
                break;
            case 'blocked':
                conditions = [ {},{"blocked":1}]
                res = (await this.#collection.find({$and: conditions}).toArray()).map(toAccount);
                break;        

        }
        return res;

    }
}

function getJwt(username, roles) {
    return jwt.sign({roles}, process.env[config.get(ENV_JWT_SECTRET)], {
        expiresIn : config.get("jwt.expiresIn"),
        subject: username
    })
}

function toAccount(accountdb) {
    const res = {username: accountdb._id, roles: accountdb.roles, passwordHash: accountdb.passwordHash, nickname: accountdb.nickname,
        active:accountdb.active, blocked: accountdb.blocked, avatar: accountdb.avatar};
    return res;
}

async function toAccountDB(account) {
    const passwordHash = await bcrypt.hash(account.password, 10); 
    const res = {_id: account.username, passwordHash, roles:account.roles, nickname: account.nickname,
        active:account.active, blocked: account.blocked, avatar: account.avatar}
      return res;
}