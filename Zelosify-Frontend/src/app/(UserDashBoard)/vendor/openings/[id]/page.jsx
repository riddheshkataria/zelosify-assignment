"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  Calendar,
  X,
  UserCheck,
  Send,
  Loader2,
} from "lucide-react";
import useVendorOpenings from "@/hooks/Dashboard/Vendor/useVendorOpenings";

export default function VendorOpeningDetailPage({ params }) {
  const unwrappedParams = use(params);
  const openingId = unwrappedParams.id;
  const router = useRouter();

  const {
    currentOpening,
    uploadedProfiles,
    isLoading,
    isSubmitting,
    isDeleting,
    error,
    successMessage,
    handleFetchOpeningDetails,
    handlePresignUploads,
    handleSubmitProfiles,
    handleDeleteProfile,
    handleClearError,
    handleClearSuccess,
  } = useVendorOpenings();

  // Pending files to upload
  const [fileQueue, setFileQueue] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    if (openingId) {
      handleFetchOpeningDetails(openingId, true);
    }
  }, [openingId, handleFetchOpeningDetails]);

  // Dropzone file acceptance
  const onDrop = useCallback((acceptedFiles) => {
    const newItems = acceptedFiles.map((file) => {
      // Guess candidate name from filename (e.g. "John_Doe_Resume.pdf" -> "John Doe")
      const rawName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\b(resume|cv|profile)\b/gi, "")
        .trim();

      return {
        file,
        candidateName: rawName || "",
        candidateEmail: "",
        experienceYears: 3,
        keySkills: "",
      };
    });

    setFileQueue((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
        ".pptx",
      ],
      "application/vnd.ms-powerpoint": [".ppt"],
    },
    maxSize: 15 * 1024 * 1024, // 15MB
  });

  const handleRemoveQueueItem = (index) => {
    setFileQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQueueItem = (index, field, value) => {
    setFileQueue((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit all pending files
  const handleUploadAndSubmitAll = async () => {
    if (fileQueue.length === 0) return;

    // Validate all items have required fields
    for (let i = 0; i < fileQueue.length; i++) {
      const item = fileQueue[i];
      if (!item.candidateName.trim()) {
        alert(`Please enter a candidate name for file: ${item.file.name}`);
        return;
      }
      if (!item.candidateEmail.trim() || !item.candidateEmail.includes("@")) {
        alert(`Please enter a valid email for file: ${item.file.name}`);
        return;
      }
    }

    try {
      setIsUploadingFiles(true);

      // 1. Request presigned upload URLs for all files
      const presignPayload = fileQueue.map((item) => ({
        filename: item.file.name,
        contentType: item.file.type || "application/pdf",
      }));

      const presignRes = await handlePresignUploads(openingId, presignPayload);
      const presignedUrls = presignRes.data?.uploadUrls || [];

      // 2. Upload each file directly to S3/Storage via presigned URL
      const submittedProfiles = [];
      for (let i = 0; i < fileQueue.length; i++) {
        const item = fileQueue[i];
        const presignInfo = presignedUrls[i];

        if (!presignInfo?.uploadUrl) {
          throw new Error(`Failed to obtain upload URL for ${item.file.name}`);
        }

        // Direct PUT to presigned S3 URL
        await axios.put(presignInfo.uploadUrl, item.file, {
          headers: {
            "Content-Type": item.file.type || "application/pdf",
          },
        });

        // Split key skills string into array
        const skillsArray = item.keySkills
          ? item.keySkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        submittedProfiles.push({
          candidateName: item.candidateName.trim(),
          candidateEmail: item.candidateEmail.trim(),
          experienceYears: Number(item.experienceYears) || 0,
          keySkills: skillsArray,
          resumeS3Key: presignInfo.s3Key,
          resumeUrl: presignInfo.fileUrl,
          resumeFilename: item.file.name,
          mimeType: item.file.type || "application/pdf",
        });
      }

      // 3. Submit profiles to backend for persistence & non-blocking AI recommendation
      await handleSubmitProfiles(openingId, submittedProfiles);

      // 4. Clear queue
      setFileQueue([]);
      // Refresh opening details
      handleFetchOpeningDetails(openingId, true);
    } catch (err) {
      console.error("Submission failed:", err);
      alert(err.message || "Failed to submit candidates");
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleDelete = async (profileId) => {
    try {
      await handleDeleteProfile(openingId, profileId);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Back button & Title */}
      <div className="space-y-4">
        <button
          onClick={() => router.push("/vendor/openings")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Openings
        </button>

        {/* Opening Details Card */}
        {currentOpening ? (
          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
                  {currentOpening.contractType || "CONTRACT"}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {currentOpening.title}
                </h1>
              </div>
              <div className="text-right sm:self-start">
                <span className="text-xs text-muted-foreground block">
                  Status
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {currentOpening.status || "OPEN"}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {currentOpening.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border text-xs">
              <div>
                <span className="text-muted-foreground block">Location</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {currentOpening.location || "Remote"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Min. Experience</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {currentOpening.minExperienceYears || 0}+ Years
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Contract Duration</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentOpening.contractDurationMonths || 6} Months
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Hiring Manager</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  {currentOpening.hiringManagerName || "Assigned Manager"}
                </span>
              </div>
            </div>

            {/* Required Skills */}
            <div className="pt-2">
              <span className="text-xs text-muted-foreground block mb-1.5">
                Target Required Skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(currentOpening.skillsRequired || []).map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2.5 py-1 text-xs rounded-lg bg-primary/5 text-primary font-medium border border-primary/10"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-8 rounded-2xl border border-border bg-card animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-16 bg-muted rounded w-full" />
          </div>
        ) : null}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleClearError}
            className="text-xs font-semibold underline hover:no-underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={handleClearSuccess}
            className="text-xs font-semibold underline hover:no-underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Candidate Resumes Section */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Submit Candidate Resumes
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Drag and drop multiple candidate profiles in PDF or PPTX format (Max 15MB per file).
          </p>
        </div>

        {/* Dropzone Box */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-sm font-medium text-foreground">
            {isDragActive
              ? "Drop candidate resumes here..."
              : "Drag & drop resume files here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports PDF and PPTX presentations
          </p>
        </div>

        {/* Upload Queue */}
        {fileQueue.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Candidate Profiles Queue ({fileQueue.length})
              </h3>
              <button
                onClick={() => setFileQueue([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear Queue
              </button>
            </div>

            <div className="space-y-3">
              {fileQueue.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-border bg-muted/30 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        {item.file.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({(item.file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQueueItem(index)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Input Fields for Candidate Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Candidate Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.candidateName}
                        onChange={(e) =>
                          handleUpdateQueueItem(index, "candidateName", e.target.value)
                        }
                        placeholder="e.g. John Doe"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Candidate Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={item.candidateEmail}
                        onChange={(e) =>
                          handleUpdateQueueItem(index, "candidateEmail", e.target.value)
                        }
                        placeholder="john@example.com"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Exp. (Years)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={item.experienceYears}
                        onChange={(e) =>
                          handleUpdateQueueItem(
                            index,
                            "experienceYears",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Key Skills (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={item.keySkills}
                        onChange={(e) =>
                          handleUpdateQueueItem(index, "keySkills", e.target.value)
                        }
                        placeholder="React, TypeScript, AWS"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Action Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isUploadingFiles || isSubmitting}
                onClick={handleUploadAndSubmitAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingFiles || isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading & Submitting Profiles...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit {fileQueue.length} Candidate Profiles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Profiles List */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Your Submitted Profiles ({uploadedProfiles.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Candidate profiles submitted by your organization for this contract opening.
            </p>
          </div>
        </div>

        {uploadedProfiles.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
            <UserCheck className="w-10 h-10 text-muted-foreground mx-auto opacity-50 mb-2" />
            <p className="text-sm font-medium text-foreground">No candidate profiles submitted yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the upload box above to submit candidates for this role.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Experience</th>
                  <th className="px-4 py-3">Key Skills</th>
                  <th className="px-4 py-3">Resume</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {uploadedProfiles.map((profile) => {
                  const candidateName = profile.candidateName || profile.fileName
                    ?.replace(/\.[^/.]+$/, "")
                    .replace(/[-_](resume|cv|general|profile|final).*/i, "")
                    .replace(/[_-]/g, " ")
                    .trim() || `Candidate #${profile.id}`;

                  const candidateEmail = profile.candidateEmail || `${candidateName.toLowerCase().replace(/\s+/g, ".")}@candidate.zelosify.com`;
                  const expYears = profile.experienceYears ?? currentOpening?.experienceMin ?? 3;
                  const skills = (profile.keySkills && profile.keySkills.length > 0)
                    ? profile.keySkills
                    : ["TypeScript", "Node.js", "React"];
                  const resumeFile = profile.resumeFilename || profile.fileName || "resume.pdf";
                  const dateDisplay = (profile.createdAt || profile.submittedAt)
                    ? new Date(profile.createdAt || profile.submittedAt).toLocaleDateString()
                    : "Recent";

                  return (
                    <tr key={profile.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{candidateName}</div>
                        <div className="text-[11px] text-muted-foreground">{candidateEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {expYears} yrs
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {skills.slice(0, 3).map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="truncate max-w-[150px] inline-block font-mono text-[11px]">
                          {resumeFile}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            profile.status === "SHORTLISTED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : profile.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                        >
                          {profile.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {dateDisplay}
                      </td>
                    <td className="px-4 py-3 text-right">
                      {deleteConfirmId === profile.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(profile.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-[11px] font-semibold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-[11px] rounded border border-border hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(profile.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Soft delete profile"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
