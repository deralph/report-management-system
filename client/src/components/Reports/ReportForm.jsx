import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
// NOTE: we still use the react-cloudinary-upload-widget <Widget /> component if the script loads
import { Widget } from "react-cloudinary-upload-widget";
import { useAuth } from "../../context/AuthContext";

const ReportForm = ({ editMode = false }) => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categories: [],
    area: "",
    locationDescription: "",
    anonymous: false,
    image: "",
  });

  const [loading, setLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cloudinary state
  const [cloudinaryReady, setCloudinaryReady] = useState(false);
  const [widgetLoadError, setWidgetLoadError] = useState("");

  // --- Cloudinary script loader ---
  const loadCloudinaryScript = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") return reject(new Error("No window"));
      if (window.cloudinary) return resolve(); // already loaded

      const scriptId = "cloudinary-widget-script";
      if (document.getElementById(scriptId)) {
        // script already injected but not ready yet
        const check = setInterval(() => {
          if (window.cloudinary) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        // timeout fallback
        setTimeout(() => {
          clearInterval(check);
          if (window.cloudinary) resolve();
          else reject(new Error("Cloudinary widget failed to load (timeout)"));
        }, 7000);
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://widget.cloudinary.com/v2.0/global/all.js";
      script.async = true;
      script.onload = () => {
        if (window.cloudinary) resolve();
        else
          reject(
            new Error("Cloudinary loaded but window.cloudinary is undefined")
          );
      };
      script.onerror = () =>
        reject(new Error("Failed to load Cloudinary widget script"));
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    // Validate env vars before attempting to load script
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setWidgetLoadError(
        "Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your .env"
      );
      setCloudinaryReady(false);
      return;
    }

    // Attempt to load Cloudinary script
    loadCloudinaryScript()
      .then(() => {
        setCloudinaryReady(true);
        setWidgetLoadError("");
      })
      .catch((err) => {
        console.error("Cloudinary widget load error:", err);
        setWidgetLoadError(
          "Image widget failed to load — using fallback uploader."
        );
        setCloudinaryReady(false);
      });
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editMode && id) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/${id}`);
      if (!res.data?.data) throw new Error("Failed to fetch report");

      const report = res.data.data;
      // normalize into new formData shape
      setFormData({
        title: report.title || "",
        description: report.description || "",
        categories: Array.isArray(report.category)
          ? report.category
          : report.category
          ? [report.category]
          : [],
        area: report.area || report.location || "",
        locationDescription: report.locationDescription || "",
        anonymous: !!report.anonymous,
        image:
          (Array.isArray(report.images) && report.images[0]) ||
          report.image ||
          "",
      });
    } catch (err) {
      setError(err.message || "Error fetching report");
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

  const handleCategoryChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setFormData((prev) => ({ ...prev, categories: selected }));
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
          // keep old gpsCoordinates fields for compatibility if any
          gpsCoordinates: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
          // fill area/locationDescription heuristically (optional)
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
    // The react-cloudinary-upload-widget returns the result object; extract secure URL
    try {
      const url = result?.info?.secure_url;
      if (url) {
        setFormData((prev) => ({ ...prev, image: url }));
        setSuccess("Image uploaded");
      } else {
        setError("Upload succeeded but no URL returned");
      }
    } catch (err) {
      setError("Failed to process upload result");
    }
  };

  // Fallback file uploader (unsigned upload via REST) if widget isn't available
  const handleFileChange = async (e) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError("Cloudinary not configured on server. Please contact admin.");
      return;
    }

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);

      const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
        {
          method: "POST",
          body: fd,
        }
      );
      const data = await resp.json();
      if (data.secure_url) {
        setFormData((prev) => ({ ...prev, image: data.secure_url }));
        setSuccess("Image uploaded (fallback)");
      } else {
        console.error("Cloudinary upload response:", data);
        setError("Fallback upload failed");
      }
    } catch (err) {
      console.error("Fallback upload error:", err);
      setError("Fallback upload failed");
    } finally {
      setLoading(false);
    }
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

      const payload = {
        title: formData.title,
        description: formData.description,
        categories: formData.categories,
        area: formData.area,
        locationDescription: formData.locationDescription,
        anonymous: formData.anonymous,
        image: formData.image,
        // keep gpsCoordinates if present for backward compatibility
        gpsCoordinates: formData.gpsCoordinates,
      };

      const res = await fetch(url, {
        method: editMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success || data.status === "success") {
        setSuccess(
          editMode
            ? "Report updated successfully!"
            : "Report submitted successfully!"
        );
        setTimeout(
          () => navigate(editMode ? `/report/${id}` : "/dashboard"),
          1200
        );
      } else {
        setError(data.message || "Failed to submit report");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Render
  return (
    <div className="container mx-auto px-4 py-8">
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

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-md rounded-lg p-6"
        >
          {/* title, categories, area, locationDescription, description omitted for brevity - same as before */}
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

          <div className="mb-4">
            <label className="block mb-1">Category *</label>
            <select
              name="categories"
              multiple
              value={formData.categories}
              onChange={handleCategoryChange}
              required
              className="w-full border rounded px-3 py-2 h-32"
            >
              {[
                { value: "theft", label: "Theft & Burglary" },
                { value: "assault", label: "Physical Assault & Harassment" },
                { value: "fire", label: "Fire Outbreak" },
                { value: "medical", label: "Medical Emergency" },
                { value: "vandalism", label: "Vandalism & Property Damage" },
                { value: "substance", label: "Substance Abuse & Misconduct" },
                {
                  value: "unauthorized",
                  label: "Unauthorized Access or Trespassing",
                },
                { value: "environmental", label: "Environmental Hazard" },
                { value: "protest", label: "Protest & Public Disturbance" },
              ].map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Hold Ctrl (Cmd on Mac) to select multiple
            </p>
          </div>

          <div className="mb-4">
            <label className="block mb-1">Area *</label>
            <input
              type="text"
              name="area"
              value={formData.area}
              onChange={handleChange}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="E.g. Library Block A, Hostel Zone 2"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">Description of Location *</label>
            <textarea
              name="locationDescription"
              value={formData.locationDescription}
              onChange={handleChange}
              required
              rows={3}
              className="w-full border rounded px-3 py-2"
              placeholder="Describe where exactly this happened"
            />
          </div>

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

          {/* Image uploader: widget if ready, else fallback file input */}
          <div className="mb-4">
            <label className="block mb-1">Upload Image (Optional)</label>

            {CLOUD_NAME && UPLOAD_PRESET && cloudinaryReady ? (
              <>
                <Widget
                  sources={["local", "camera"]}
                  cloudName={CLOUD_NAME}
                  uploadPreset={UPLOAD_PRESET}
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
                  onFailure={(err) => {
                    console.error("Widget failure:", err);
                    setWidgetLoadError(
                      "Widget failed. Use fallback upload below."
                    );
                  }}
                  logging={false}
                  folder="reports"
                  cropping={false}
                  multiple={false}
                  autoClose={true}
                />
                {widgetLoadError && (
                  <p className="text-sm text-yellow-600 mt-2">
                    {widgetLoadError}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-2">
                  Image upload widget not available. Use this fallback file
                  uploader.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block"
                />
              </>
            )}

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
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Important Information
          </h3>
          <ul className="list-disc list-inside text-blue-700 space-y-1">
            <li>
              Please provide accurate and detailed information to help security
              personnel respond effectively.
            </li>
            <li>
              In case of emergency, always call the campus security hotline
              first: <strong>+234-XXX-XXXX-XXX</strong>
            </li>
            <li>False reporting may lead to disciplinary action.</li>
            <li>Your report will be handled with confidentiality.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReportForm;
