import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ReportView = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const { id } = useParams();
  const { user, api } = useAuth();

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/reports/${id}`);
      // API returns report in response.data.data (as before)
      setReport(response.data.data);
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await api.post(`/api/reports/${id}/comments`, { text: comment });
      setComment("");
      await fetchReport();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!user) return;
    if (user.role !== "admin" && user.role !== "security") return;

    try {
      await api.put(`/api/reports/${id}`, { ...report, status: newStatus });
      await fetchReport();
    } catch (error) {
      console.error("Error updating report status:", error);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        await api.delete(`/api/reports/${reportId}`);
        window.location.href = "/dashboard";
      } catch (error) {
        console.error("Error deleting report:", error);
      }
    }
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const isOwner = (r) => {
    if (!user || !r) return false;
    const creator = r.createdBy;
    if (!creator) return false;
    // createdBy might be populated object or just id string
    const creatorId =
      typeof creator === "string"
        ? creator
        : creator._id || creator.id || creator;
    return String(creatorId) === String(user._id);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Report not found
          </h2>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // category can be array or string (legacy)
  const categories = Array.isArray(report.category)
    ? report.category
    : report.category
    ? [report.category]
    : [];

  const images =
    Array.isArray(report.images) && report.images.length > 0
      ? report.images
      : report.image
      ? [report.image]
      : [];

  const canEdit =
    user &&
    (user.role === "admin" || user.role === "security" || isOwner(report));
  const canDelete = user && isOwner(report);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-800">{report.title}</h1>

          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              report.status === "resolved"
                ? "bg-green-100 text-green-800"
                : report.status === "in-progress"
                ? "bg-blue-100 text-blue-800"
                : report.status === "referred"
                ? "bg-purple-100 text-purple-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {String(report.status || "pending")
              .replace("-", " ")
              .toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Category</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.length ? (
                categories.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-sm capitalize"
                  >
                    {c.replace("-", " ")}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">Uncategorized</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Area</h3>
            <p className="text-lg">
              {report.area || report.location || "Not specified"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">
              Location Details
            </h3>
            <p className="text-lg whitespace-pre-wrap">
              {report.locationDescription ||
                "No additional location description"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Reported By</h3>
            <p className="text-lg">
              {report.anonymous
                ? "Anonymous"
                : report.createdBy?.name || "Unknown"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Reported on {formatDate(report.createdAt)}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Description
          </h3>
          <p className="text-gray-800 whitespace-pre-wrap">
            {report.description}
          </p>
        </div>

        {images.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Images</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Evidence ${idx + 1}`}
                  className="rounded-lg shadow-md object-cover w-full h-64"
                />
              ))}
            </div>
          </div>
        )}

        {user && (user.role === "admin" || user.role === "security") && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Update Status
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusUpdate("pending")}
                className={`px-3 py-1 rounded-md text-sm ${
                  report.status === "pending"
                    ? "bg-yellow-600 text-white"
                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => handleStatusUpdate("in-progress")}
                className={`px-3 py-1 rounded-md text-sm ${
                  report.status === "in-progress"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => handleStatusUpdate("resolved")}
                className={`px-3 py-1 rounded-md text-sm ${
                  report.status === "resolved"
                    ? "bg-green-600 text-white"
                    : "bg-green-100 text-green-800 hover:bg-green-200"
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => handleStatusUpdate("referred")}
                className={`px-3 py-1 rounded-md text-sm ${
                  report.status === "referred"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-100 text-purple-800 hover:bg-purple-200"
                }`}
              >
                Referred
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          {canEdit && (
            <Link
              to={`/report/edit/${report._id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Edit Report
            </Link>
          )}
          {canDelete && (
            <button
              onClick={() => handleDeleteReport(report._id)}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Delete Report
            </button>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Comments</h2>

        {report.comments && report.comments.length > 0 ? (
          <div className="space-y-4 mb-6">
            {report.comments.map((c) => (
              <div
                key={c._id}
                className="border-b border-gray-200 pb-4 last:border-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium">{c.user?.name || "Unknown"}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(c.createdAt)}
                  </p>
                </div>
                <p className="text-gray-800">{c.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 mb-6">No comments yet.</p>
        )}

        <form onSubmit={handleAddComment}>
          <div className="mb-4">
            <label
              htmlFor="comment"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Add a Comment
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add your comment here..."
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
          >
            Add Comment
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportView;
