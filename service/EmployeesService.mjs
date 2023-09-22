import config from 'config'
import MongoConnection from '../domain/MongoConnection.mjs'
const MONGO_ENV_URI = 'mongodb.env_uri';
const MONGO_DB_NAME = 'mongodb.db';


export default class EmployeesService {
    #collection
    constructor() {
        const connection_string = process.env[config.get(MONGO_ENV_URI)];
        const dbName = config.get(MONGO_DB_NAME);
        const connection = new MongoConnection(connection_string, dbName);
        this.#collection = connection.getCollection('employees');
    }
    async #getId() {
        let id;
        const minId = config.get("employee.minId");
        const maxId = config.get("employee.maxId");
        const delta = maxId - minId + 1; 
        do {
            id = minId + Math.trunc(Math.random() * delta)
        }while(await this.getEmployee(id));
        return id;
    }
    async getEmployee(id) {
        const doc = await this.#collection.findOne({_id:id});
        return doc ? toEmployee(doc) : null;
    }
    async addEmployee(employee) {
        let emplRes;
        if(!employee.id) {
            employee.id = await this.#getId();
        }
        try{
            await this.#collection.insertOne(toDocument(employee));
            emplRes = employee;
        } catch (error) {   
            if(error.code != 11000) {
                throw error;
            }
        }
        return emplRes;
    }
    async updateEmployee(employee) {
        let emplRes;
        const doc = await this.#collection.updateOne({_id: employee.id},
            {$set:{department:employee.department, salary:employee.salary}});
        return doc.matchedCount == 1 ? employee : null;
    }
    async deleteEmployee(id) {
        const doc = await this.#collection.deleteOne({_id:id});
        return doc.deletedCount > 0;
    }
    async getAllEmployees() {
        return ((await this.#collection.find({}).toArray()).map(toEmployee));
    }
}
function toDocument(employee){
    const document = {...employee, _id: employee.id};
    delete document.id;
    return document;
}
function toEmployee(document) {
    const employee = {...document, id:document._id};
    delete employee._id;
    return employee;
}