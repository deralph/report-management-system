import React from "react";
import { Link } from "react-router-dom";

const ReportList = ({
  reports = [],
  showActions = false,
  onDelete,
  onStatusUpdate,
}) => {
  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: "bg-yellow-100 text-yellow-800",
      "in-progress": "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      referred: "bg-purple-100 text-purple-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          statusClasses[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {String(status || "pending")
          .replace("-", " ")
          .toUpperCase()}
      </span>
    );
  };

  const categoryLabel = (cat) => {
    const map = {
      theft: "Theft & Burglary",
      assault: "Physical Assault",
      fire: "Fire Outbreak",
      medical: "Medical Emergency",
      vandalism: "Vandalism",
      substance: "Substance Abuse",
      unauthorized: "Unauthorized Access",
      environmental: "Environmental Hazard",
      protest: "Protest & Disturbance",
    };
    return map[cat] || String(cat).replace(/-/g, " ");
  };

  // Helper to normalize category(s) into array
  const normalizeCategories = (category) => {
    if (!category) return [];
    if (Array.isArray(category)) return category;
    return [category];
  };

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <div className="min-w-full">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Title
              </th>
              {/* <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Category
              </th> */}
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 hidden sm:table-cell">
                Area
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                Date
              </th>
              {showActions && (
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={showActions ? 6 : 5}
                  className="px-3 py-8 text-center text-sm text-gray-500"
                >
                  No reports found.
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const cats = normalizeCategories(report.category);
                const displayArea = report.area || report.location || "-";
                return (
                  <tr key={report._id}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                      <Link
                        to={`/report/${report._id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {report.title}
                      </Link>
                    </td>

                    {/* <td className="px-3 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-2">
                        {cats.length === 0 ? (
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
                            Uncategorized
                          </span>
                        ) : (
                          cats.map((c, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs"
                            >
                              {categoryLabel(c)}
                            </span>
                          ))
                        )}
                      </div>
                    </td> */}

                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {displayArea}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {getStatusBadge(report.status)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>

                    {showActions && (
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link
                          to={`/report/${report._id}`}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View
                        </Link>
                        <Link
                          to={`/report/edit/${report._id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => onDelete && onDelete(report._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportList;
