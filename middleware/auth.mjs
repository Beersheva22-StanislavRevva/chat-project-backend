import jwt from "jsonwebtoken";
import config from 'config';
const BEARER = 'Bearer ';
const auth = (req,res,next) => {
    const authHeader = req.header("Authorization");
    if(authHeader && authHeader.startsWith(BEARER)) {
        const accessToken = authHeader.substring(BEARER.length);
        try {
            const payload = jwt.verify(accessToken, process.env[config.get('jwt.env_secret')]);
            req.user = {username: payload.sub, roles: payload.roles};
        } catch (error) {

        }
    }
    next();
}
export default auth;