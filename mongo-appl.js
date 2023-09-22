import MongoConnection from "./domain/MongoConnection.mjs";
const mongoConnection = new MongoConnection(process.env.ATLAS_URI, 'college')
const studentsMdb = mongoConnection.getCollection('students');
studentsMdb.find({phone:{$regex:/^050/}}).toArray().then(data => console.log(data));