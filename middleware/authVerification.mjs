const authVerification = (...roles) => {
    return (req, res, next) => {
        if(!req.user){
            res.status(401);
            throw 'not authenticated';
        }
        const userRoles = req.user.roles;
        if(!userRoles.some(ur => roles.includes(ur))) {
            res.status(403);
            throw 'access denied';
        }
        next();
    }
}
export default authVerification;