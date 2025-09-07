// server/routes/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  // clone user object safely then remove password for response
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;

  res.status(statusCode).json({
    status: "success",
    token,
    data: { user: userObj },
  });
};

// ---------- Register ----------
export const Register = async (req, res) => {
  try {
    // Expect explicit fields depending on role:
    // student register -> { name, email, password, matricNumber, role: 'student', ... }
    // staff register   -> { name, email, password, adminId, role: 'admin'|'security'|'medical'|'special', ... }
    const {
      name,
      email,
      password,
      role,
      matricNumber,
      adminId,
      department,
      phone,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        status: "error",
        message: "name, email and password are required",
      });
    }

    // role default
    const finalRole = role || "student";

    if (finalRole === "student") {
      if (!matricNumber) {
        return res.status(400).json({
          status: "error",
          message: "matricNumber is required for student registration",
        });
      }

      // check existing by email or matricNumber
      const exists = await User.findOne({
        $or: [{ email }, { matricNumber }],
      });
      if (exists) {
        return res.status(400).json({
          status: "error",
          message: "User already exists with this email or matric number",
        });
      }

      const userData = {
        name,
        email,
        password,
        role: "student",
        matricNumber,
        department,
        phone,
      };

      const newUser = await User.create(userData);
      createSendToken(newUser, 201, res);
      return;
    }

    // staff
    const allowedStaffRoles = ["admin", "security", "medical", "special"];
    if (!allowedStaffRoles.includes(finalRole)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid role. Allowed staff roles: ${allowedStaffRoles.join(
          ", "
        )}`,
      });
    }

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "adminId (staff ID) is required for staff registration",
      });
    }

    // check existing by email or adminId
    const existsStaff = await User.findOne({
      $or: [{ email }, { adminId }],
    });
    if (existsStaff) {
      return res.status(400).json({
        status: "error",
        message: "User already exists with this email or staff ID",
      });
    }

    const staffData = {
      name,
      email,
      password,
      role: finalRole,
      adminId,
      department,
      phone,
    };

    const newStaff = await User.create(staffData);
    createSendToken(newStaff, 201, res);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// ---------- Login ----------
export const Login = async (req, res) => {
  try {
    // Expect explicit fields:
    // Student login -> { matricNumber, password, role: 'student' } or role omitted but matricNumber present
    // Staff login   -> { adminId, password, role: 'admin'|'security'|'medical'|'special' } OR { email, password } for email login
    const { matricNumber, adminId, email, password, role } = req.body;

    if (!password) {
      return res.status(400).json({
        status: "error",
        message: "Password is required",
      });
    }

    let query;
    // If matricNumber present (student case)
    if (matricNumber) {
      query = { matricNumber };
    } else if (adminId) {
      query = { adminId };
    } else if (email) {
      query = { email };
    } else {
      return res.status(400).json({
        status: "error",
        message:
          "Login requires matricNumber (student) or adminId/email (staff) along with password",
      });
    }

    // fetch user with password
    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect credentials",
      });
    }

    const isCorrect = await user.correctPassword(password, user.password);
    if (!isCorrect) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect credentials",
      });
    }

    // If role is provided, ensure it matches the user's role (helps prevent cross-role login)
    if (role && user.role !== role) {
      return res.status(403).json({
        status: "error",
        message: "User role does not match requested login role",
      });
    }

    createSendToken(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({ status: "success", data: { user: req.user } });
};
