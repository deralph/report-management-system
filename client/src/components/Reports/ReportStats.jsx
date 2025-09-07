import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const colorPalette = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#8ac6d1",
  "#ff6b6b",
  "#339af0",
  "#7c3aed",
  "#06b6d4",
  "#f97316",
  "#10b981",
];

const normalizeLabel = (label = "") =>
  String(label)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const ReportStats = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    referred: 0,
    byCategory: {},
  });
  const [timeRange, setTimeRange] = useState("all"); // all, month, week
  const [loading, setLoading] = useState(true);
  const { user, api } = useAuth();

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/reports/stats?range=${timeRange}`);
      if (response?.data?.data) {
        setStats(response.data.data);
      } else {
        setStats({
          total: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0,
          referred: 0,
          byCategory: {},
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // Defensive: ensure byCategory is an object of { categoryName: count }
  const byCategory =
    stats.byCategory && typeof stats.byCategory === "object"
      ? stats.byCategory
      : {};

  const categoryLabels = Object.keys(byCategory);
  const categoryCounts = categoryLabels.map((k) => byCategory[k]);

  // Chart data (use normalized labels)
  const categoryChartData = {
    labels: categoryLabels.map(normalizeLabel),
    datasets: [
      {
        label: "Reports by Category",
        data: categoryCounts,
        backgroundColor: categoryLabels.map(
          (_, i) => colorPalette[i % colorPalette.length]
        ),
        borderWidth: 1,
      },
    ],
  };

  const statusChartData = {
    labels: ["Pending", "In Progress", "Resolved", "Referred"],
    datasets: [
      {
        label: "Reports by Status",
        data: [
          stats.pending || 0,
          stats.inProgress || 0,
          stats.resolved || 0,
          stats.referred || 0,
        ],
        backgroundColor: [
          "#FFCE56", // pending - yellow
          "#36A2EB", // in progress - blue
          "#4BC0C0", // resolved - teal
          "#9966FF", // referred - purple
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  if (loading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Report Statistics</h2>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="all">All Time</option>
            <option value="month">Last Month</option>
            <option value="week">Last Week</option>
          </select>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-xl font-semibold">Report Statistics</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Time</option>
          <option value="month">Last Month</option>
          <option value="week">Last Week</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-1">
            Total Reports
          </h3>
          <p className="text-2xl font-bold text-blue-600">{stats.total || 0}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">Pending</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {stats.pending || 0}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-1">
            In Progress
          </h3>
          <p className="text-2xl font-bold text-blue-600">
            {stats.inProgress || 0}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <h3 className="text-sm font-medium text-green-800 mb-1">Resolved</h3>
          <p className="text-2xl font-bold text-green-600">
            {stats.resolved || 0}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <h3 className="text-sm font-medium text-purple-800 mb-1">Referred</h3>
          <p className="text-2xl font-bold text-purple-600">
            {stats.referred || 0}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="min-h-[320px]">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            Reports by Category
          </h3>
          {categoryLabels.length === 0 ? (
            <div className="text-gray-500">No category data available.</div>
          ) : (
            <div className="h-80">
              <Doughnut data={categoryChartData} options={chartOptions} />
            </div>
          )}
        </div>
        <div className="min-h-[320px]">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            Reports by Status
          </h3>
          <div className="h-80">
            <Bar data={statusChartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Category Breakdown
        </h3>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Category
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Count
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {categoryLabels.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-sm text-gray-500">
                    No category data
                  </td>
                </tr>
              ) : (
                categoryLabels.map((category) => {
                  const count = byCategory[category] || 0;
                  return (
                    <tr key={category}>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 capitalize">
                        {normalizeLabel(category)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {count}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {stats.total > 0
                          ? ((count / stats.total) * 100).toFixed(1) + "%"
                          : "0%"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportStats;
