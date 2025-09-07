import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ReportList from "../Reports/ReportList";

const StudentDashboard = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user, api } = useAuth();

  useEffect(() => {
    fetchUserReports();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserReports = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/reports/my-reports");
      const data = response?.data?.data;
      setReports(
        Array.isArray(data)
          ? data
          : Array.isArray(data?.reports)
          ? data.reports
          : []
      );
    } catch (error) {
      console.error("Error fetching reports:", error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/api/reports/stats");
      const data = response?.data?.data;
      // Stats endpoint may return object with totals — be defensive
      setStats({
        total: data?.total || 0,
        pending: data?.pending || 0,
        resolved: data?.resolved || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats({ total: 0, pending: 0, resolved: 0 });
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    try {
      await api.delete(`/api/reports/${reportId}`);
      setReports((prev) =>
        prev.filter((r) => String(r._id) !== String(reportId))
      );
      fetchStats();
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Welcome, {user?.name || "Student"}. Here you can manage your reports.
      </p>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Total Reports
          </h3>
          <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Pending</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Resolved</h3>
          <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/report/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
          >
            Report New Incident
          </Link>
          <Link
            to="/community"
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md"
          >
            Community Chat
          </Link>
        </div>
      </div>

      {/* User's Reports */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Reports</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchUserReports}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              You haven't submitted any reports yet.
            </p>
            <Link
              to="/report/new"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Report your first incident
            </Link>
          </div>
        ) : (
          <ReportList
            reports={reports}
            showActions={true}
            onDelete={handleDeleteReport}
          />
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
