import { MongoClient } from "mongodb";
export default class MongoConnection {
    #db
    #client
    constructor(connection_string, dbName){
       this.#client = new MongoClient(connection_string);
       this.#db = this.#client.db(dbName);
    }
    getCollection(collectionName) {
       return this.#db.collection(collectionName);
    }
}