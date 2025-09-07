import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import ReportList from "../Reports/ReportList";
import ReportStats from "../Reports/ReportStats";

const AdminDashboard = () => {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { user, api } = useAuth();

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = {};
      if (filter !== "all") params.category = filter;
      if (statusFilter !== "all") params.status = statusFilter;

      const response = await api.get("/api/reports", { params });
      // response.data.data.reports expected (defensive)
      const data = response?.data?.data;
      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      await api.put(`/api/reports/${reportId}`, { status: newStatus });
      // Refresh the reports list
      fetchReports();
    } catch (error) {
      console.error("Error updating report status:", error);
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    try {
      await api.delete(`/api/reports/${reportId}`);
      setReports((prev) =>
        prev.filter((r) => String(r._id) !== String(reportId))
      );
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Welcome, {user?.name || "User"}. Manage security and emergency reports.
      </p>

      <ReportStats />

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Reports</h2>

        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="w-full lg:w-64">
            <label
              htmlFor="category-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Category
            </label>
            <select
              id="category-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Categories</option>
              <option value="theft">Theft & Burglary</option>
              <option value="assault">Physical Assault</option>
              <option value="fire">Fire Outbreak</option>
              <option value="medical">Medical Emergency</option>
              <option value="vandalism">Vandalism</option>
              <option value="substance">Substance Abuse</option>
              <option value="unauthorized">Unauthorized Access</option>
              <option value="environmental">Environmental Hazard</option>
              <option value="protest">Protest & Disturbance</option>
            </select>
          </div>

          <div className="w-full lg:w-64">
            <label
              htmlFor="status-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="referred">Referred</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={fetchReports}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setFilter("all");
                setStatusFilter("all");
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Reports</h2>
          <div className="text-sm text-gray-500">
            {reports.length} result{reports.length !== 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          </div>
        ) : (
          <ReportList
            reports={reports}
            showActions={true}
            onDelete={handleDelete}
            onStatusUpdate={handleStatusUpdate} // ReportList currently accepts this (optional)
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
