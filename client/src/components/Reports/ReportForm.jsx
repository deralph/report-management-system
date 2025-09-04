import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { WidgetLoader, Widget } from "react-cloudinary-upload-widget";

import { useAuth } from '../../context/AuthContext';

const ReportForm = ({ editMode = false }) => {
   const { api } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "theft",
    location: "",
    gpsCoordinates: { latitude: "", longitude: "" },
    anonymous: false,
    image: "", // 👈 Cloudinary image URL
  });

  const [loading, setLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();
  const { id } = useParams();

  const categories = [
    { value: "theft", label: "Theft & Burglary" },
    { value: "assault", label: "Physical Assault & Harassment" },
    { value: "fire", label: "Fire Outbreak" },
    { value: "medical", label: "Medical Emergency" },
    { value: "vandalism", label: "Vandalism & Property Damage" },
    { value: "substance", label: "Substance Abuse & Misconduct" },
    { value: "unauthorized", label: "Unauthorized Access or Trespassing" },
    { value: "environmental", label: "Environmental Hazard" },
    { value: "protest", label: "Protest & Public Disturbance" },
  ];

  useEffect(() => {
    if (editMode && id) fetchReport();
  }, [editMode, id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/${id}`)
      console.log("report data = ", res)

      if (!res.data.data) throw new Error("Failed to fetch report");

      const report = res.data.data;
      setFormData({
        title: report.title,
        description: report.description,
        category: report.category,
        location: report.location,
        gpsCoordinates: report.gpsCoordinates || { latitude: "", longitude: "" },
        anonymous: report.anonymous,
        image: report.image || "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      gpsCoordinates: { ...prev.gpsCoordinates, [name]: value },
    }));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          gpsCoordinates: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        }));
        setIsGettingLocation(false);
      },
      () => {
        setError("Unable to retrieve your location. Please enter it manually.");
        setIsGettingLocation(false);
      }
    );
  };

  const handleCloudinarySuccess = (result) => {
    setFormData((prev) => ({ ...prev, image: result.info.secure_url }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const url = editMode
        ? `${import.meta.env.VITE_BACKEND_URL}/api/reports/${id}`
        : `${import.meta.env.VITE_BACKEND_URL}/api/reports`;

      const res = await fetch(url, {
        method: editMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(editMode ? "Report updated successfully!" : "Report submitted successfully!");
        setTimeout(() => navigate(editMode ? `/report/${id}` : "/dashboard"), 1500);
      } else {
        setError(data.message || "Failed to submit report");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading && editMode) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <WidgetLoader />
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          {editMode ? "Edit Report" : "Report Security Incident"}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
          {/* Title */}
          <div className="mb-4">
            <label className="block mb-1">Incident Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="Brief title describing the incident"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="block mb-1">Category *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="block mb-1">Location *</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="Building, room, or area"
            />
          </div>

          {/* GPS */}
          <div className="mb-4">
            <label className="block mb-1">GPS Coordinates (Optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                name="latitude"
                value={formData.gpsCoordinates.latitude}
                onChange={handleLocationChange}
                placeholder="Latitude"
                className="flex-1 border rounded px-3 py-2"
              />
              <input
                type="number"
                name="longitude"
                value={formData.gpsCoordinates.longitude}
                onChange={handleLocationChange}
                placeholder="Longitude"
                className="flex-1 border rounded px-3 py-2"
              />
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                className="px-3 py-2 bg-gray-200 rounded"
              >
                {isGettingLocation ? "..." : "Use My Location"}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block mb-1">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={5}
              className="w-full border rounded px-3 py-2"
              placeholder="Provide details (time, people involved, etc.)"
            />
          </div>

          {/* Cloudinary Upload */}
          <div className="mb-4">
            <label className="block mb-1">Upload Image (Optional)</label>
            <Widget
              sources={["local", "camera"]}
              cloudName={import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}
              uploadPreset={import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET}
              buttonText="Upload Image"
              style={{
                color: "white",
                border: "none",
                width: "140px",
                backgroundColor: "#2563EB",
                borderRadius: "6px",
                height: "40px",
              }}
              onSuccess={handleCloudinarySuccess}
              onFailure={() => setError("Image upload failed")}
              logging={false}
              folder="reports"
              cropping={false}
              multiple={false}
              autoClose={true}
            />
            {formData.image && (
              <div className="mt-2">
                <img
                  src={formData.image}
                  alt="uploaded"
                  className="w-64 h-48 object-cover rounded"
                />
              </div>
            )}
          </div>

          {/* Anonymous */}
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              name="anonymous"
              checked={formData.anonymous}
              onChange={handleChange}
              className="mr-2"
            />
            <label>Report anonymously</label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {loading
                ? "Submitting..."
                : editMode
                ? "Update Report"
                : "Submit Report"}
            </button>
          </div>
        </form>
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6"> 
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Important Information</h3> 
          <ul className="list-disc list-inside text-blue-700 space-y-1"> 
            <li>Please provide accurate and detailed information to help security personnel respond effectively.</li> 
            <li>In case of emergency, always call the campus security hotline first: <strong>+234-XXX-XXXX-XXX</strong></li>
             <li>False reporting may lead to disciplinary action.</li> <li>Your report will be handled with confidentiality.</li> 
             </ul> 
             </div>
      </div>
    </div>
  );
};

export default ReportForm;
