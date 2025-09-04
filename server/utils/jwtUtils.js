import jwt from "jsonwebtoken";
import config from "../config/config.js";

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: "1h",
  });
}

function getJwtSecret() {
  return config.jwtSecret;
}

export default  {
  generateToken,
  getJwtSecret,
};
