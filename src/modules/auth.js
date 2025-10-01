const jwt = require('jsonwebtoken');

module.exports = function validarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  jwt.verify(token, process.env.JWT_SECRET_SGI, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.user = user;
    next();
  });
};