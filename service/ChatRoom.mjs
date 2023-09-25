export default class ChatRoom {
    #clients; //<client name>: <array of connections ids>
    #connections; //<connection id>: {client: <clientName>, socket: <Web socket>}
    constructor() {
        this.#clients = {};
        this.#connections = {};
    }
    addConnection(clientName, connectionId, ws) {
        this.#connections[connectionId] = { client: clientName, socket: ws };
        if (this.#clients[clientName]) {
            this.#clients[clientName].push(connectionId);
        } else {
            this.#clients[clientName] = [connectionId];
            }
    }
    removeConnection(connectionId) {
        const client = this.#connections[connectionId].client;
        const clientConnections = this.#clients[client];
        const index = clientConnections.findIndex((id) => id == connectionId);
        if (index < 0) {
            throw `illegal state with connection ${connectionId}`;
        }
        clientConnections.splice(index, 1);
        if (clientConnections.length == 0) {
            delete this.#clients[client];
        }
        delete this.#connections[connectionId];
    }
    getClientWebSockets(clientName) {
        let res = [];
        if (this.#clients[clientName]) {
            res = this.#clients[clientName].map(
                (connectionId) => this.#connections[connectionId].socket,
            );
        }
        return res;
    }
    getClients() {
        return Object.keys(this.#clients);
    }
    getAllWebsockets() {
        return Object.values(this.#connections).map(c => c.socket);
    }
}