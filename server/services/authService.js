import  User from "../models/User.js";

async function findUserByUsername(username) {
  return await User.findOne({ username });
}

export default {
  findUserByUsername,
};
