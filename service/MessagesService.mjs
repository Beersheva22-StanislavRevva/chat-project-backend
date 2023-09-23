import config from 'config'
import MongoConnection from '../domain/MongoConnection.mjs'
const MONGO_ENV_URI = 'mongodb.env_uri';
const MONGO_DB_NAME = 'mongodb.db';


export default class MessagesService {
    #collection
    constructor() {
        const connection_string = process.env[config.get(MONGO_ENV_URI)];
        const dbName = config.get(MONGO_DB_NAME);
        const connection = new MongoConnection(connection_string, dbName);
        this.#collection = connection.getCollection('messages');
    }
    async #getId() {
        let id;
        const minId = config.get("employee.minId");
        const maxId = config.get("employee.maxId");
        const delta = maxId - minId + 1; 
        do {
            id = minId + Math.trunc(Math.random() * delta)
        }while(await this.getMessage(id));
        return id;
    }
    async getMessage(id) {
        const doc = await this.#collection.findOne({_id:id});
        return doc ? toMessage(doc) : null;
    }
    async addMessage(message) {
        let msgRes;
        if(!message.id) {
            message.id = await this.#getId();
        }
        try{
            await this.#collection.insertOne(toDocument(message));
            msgRes = message;
        } catch (error) {   
            if(error.code != 11000) {
                throw error;
            }
        }
        return msgRes;
    }
    async updateMessage(message) {
        let msgRes;
        const doc = await this.#collection.updateOne({_id: message.id},
            {$set:{text:message.text }});
        return doc.matchedCount == 1 ? message : null;
    }
    async deleteMessage(id) {
        const doc = await this.#collection.deleteOne({_id:id});
        return doc.deletedCount > 0;
    }
    async getAllMessages() {
        return ((await this.#collection.find({}).toArray()).map(toMessage));
    }
    async getIncomingMessages(sendername, recepientname) {
        let sndName = sendername;
        let rcpName = recepientname;
        let conditions = [ {"from":sndName},{"to":rcpName}]
        if(sndName == "all"){
            conditions[0] = {};
        }
        if(rcpName == "all"){
            conditions[1] = {};
        }
        return ((await this.#collection.find({$and: conditions}).toArray()).map(toMessage));
    }
}
function toDocument(message){
    const document = {...message, _id: message.id};
    delete document.id;
    return document;
}
function toMessage(document) {
    const message = {...document, id:document._id};
    delete message._id;
    return message;
}