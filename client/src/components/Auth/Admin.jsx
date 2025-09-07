import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Staff auth page (Admin / Security / Medical / Special)
 * - Uses adminId for staff identifier (model: adminId)
 * - Role select controls the role value sent to backend
 * - Login payload: { adminId, password, role }
 * - Register payload: { name, email, adminId, password, role, department, phone }
 */
const StaffAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    adminId: "",
    password: "",
    confirmPassword: "",
    role: "admin", // default staff role
    department: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const submitRegister = async () => {
    if (form.password !== form.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    return {
      name: form.name,
      email: form.email,
      adminId: form.adminId,
      password: form.password,
      role: form.role, // 'admin' | 'security' | 'medical' | 'special'
      department: form.department || undefined,
      phone: form.phone || undefined,
    };
  };

  const submitLogin = async () => {
    return {
      adminId: form.adminId,
      password: form.password,
      role: form.role,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const payload = await submitLogin();
        await login(payload);
        // redirect to admin area for admin / security etc. Adjust as needed:
        navigate("/admin");
      } else {
        const payload = await submitRegister();
        await register(payload);
        navigate("/admin");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-8">
        <h2 className="text-center text-2xl font-semibold mb-4">
          {isLogin ? "Staff Login" : "Staff Register"}
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Full name"
                className="w-full border rounded px-3 py-2"
              />
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="Email address"
                className="w-full border rounded px-3 py-2"
              />
            </>
          )}

          <div>
            <label className="text-sm text-gray-700 mb-1 block">Staff ID</label>
            <input
              name="adminId"
              value={form.adminId}
              onChange={handleChange}
              required
              placeholder="Staff ID"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700 mb-1 block">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            >
              <option value="admin">Admin</option>
              <option value="security">Security</option>
              <option value="medical">Medical</option>
              <option value="special">Special</option>
            </select>
          </div>

          {!isLogin && (
            <>
              <input
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="Department (optional)"
                className="w-full border rounded px-3 py-2"
              />
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone (optional)"
                className="w-full border rounded px-3 py-2"
              />
            </>
          )}

          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
          />

          {!isLogin && (
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm password"
              className="w-full border rounded px-3 py-2"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
          >
            {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setError("");
              setIsLogin((s) => !s);
            }}
            className="text-blue-600 font-medium"
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default StaffAuth;
