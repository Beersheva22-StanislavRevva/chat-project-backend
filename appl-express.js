import bodyParser from 'body-parser';
import express from 'express'
import { users } from './routes/users.mjs';
import cors from 'cors';
import morgan from 'morgan';
import config from 'config';
import errorHandler from './middleware/errorHandler.mjs';
import auth from './middleware/auth.mjs';
import { employees } from './routes/employees.mjs';
import expressWs from 'express-ws';

const app = express();
const expressWsInstant = expressWs(app);
const wss = expressWsInstant.getWss();

app.use(cors());
app.use(bodyParser.json());
app.use(morgan('tiny'));
app.use(auth);
app.ws('/employees/websocket', (ws, req) => {
    console.log(`connection from ${req.socket.remoteAddress}`)
    ws.send("Hello");
    wss.clients.forEach(socket => socket.send(`number of connections is ${wss.clients.size}, protocol ${ws.protocol}`))
})
app.use((req,res,next) => {
    req.wss = wss;
    next();
})
app.use('/employees', employees);
app.use('/users',users);
const port = process.env.PORT || config.get('server.port')
const server = app.listen(port);
server.on("listening", () => console.log(`server is listening on port ${server.address().port}`))
app.use(errorHandler);