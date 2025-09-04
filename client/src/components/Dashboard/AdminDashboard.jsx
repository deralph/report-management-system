import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import ReportList from '../Reports/ReportList';
import ReportStats from '../Reports/ReportStats';

const AdminDashboard = () => {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { user,api } = useAuth();

  useEffect(() => {
    fetchReports();
  }, [filter, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = {};
      if (filter !== 'all') params.category = filter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const response = await api.get('/api/reports', { params });
      console.log("admin reports data = ", response.data.data);
      setReports(response.data.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
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
      console.error('Error updating report status:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <p className="text-gray-600 mb-8">Welcome, {user?.name}. Manage security and emergency reports.</p>
      
      <ReportStats />
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Reports</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
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
          
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
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
              <option value="referred">Referred to Special Unit</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={fetchReports}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">All Reports</h2>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <ReportList 
            reports={reports} 
            showActions={true}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;