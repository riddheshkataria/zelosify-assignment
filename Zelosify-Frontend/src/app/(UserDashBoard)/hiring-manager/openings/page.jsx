"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  MapPin,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
  Search,
  Plus,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Edit,
} from "lucide-react";
import useHiringManager from "@/hooks/Dashboard/HiringManager/useHiringManager";
import axiosInstance from "@/utils/Axios/AxiosInstance";

export default function HiringManagerOpeningsPage() {
  const router = useRouter();
  const {
    openings,
    isLoading,
    error,
    handleFetchOpenings,
    handleClearError,
  } = useHiringManager();

  const [activeTab, setActiveTab] = useState("contracts"); // 'contracts' | 'applications'
  const [searchTerm, setSearchTerm] = useState("");

  // Create Contract Opening Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOpening, setNewOpening] = useState({
    title: "",
    description: "",
    location: "Remote",
    contractType: "C2C",
    experienceMin: 3,
    experienceMax: 8,
  });

  // Edit Contract Status Modal
  const [editOpening, setEditOpening] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // All Applications state
  const [applications, setApplications] = useState([]);
  const [isAppsLoading, setIsAppsLoading] = useState(false);

  const fetchApplications = useCallback(async () => {
    setIsAppsLoading(true);
    try {
      const res = await axiosInstance.get("/hiring/applications");
      setApplications(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setIsAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    handleFetchOpenings({ forceRefresh: true });
    fetchApplications();
  }, [handleFetchOpenings, fetchApplications]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newOpening.title.trim()) return;
    setIsCreating(true);
    try {
      await axiosInstance.post("/hiring/openings", newOpening);
      setIsCreateModalOpen(false);
      setNewOpening({
        title: "",
        description: "",
        location: "Remote",
        contractType: "C2C",
        experienceMin: 3,
        experienceMax: 8,
      });
      handleFetchOpenings({ forceRefresh: true });
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to create opening");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    if (!editOpening) return;
    setIsUpdatingStatus(true);
    try {
      await axiosInstance.put(`/hiring/openings/${editOpening.id}`, { status });
      setEditOpening(null);
      handleFetchOpenings({ forceRefresh: true });
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to update contract status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filteredOpenings = openings.filter((op) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      op.title?.toLowerCase().includes(term) ||
      op.description?.toLowerCase().includes(term) ||
      (op.skillsRequired || []).some((s) => s.toLowerCase().includes(term))
    );
  });

  const filteredApplications = applications.filter((app) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      app.candidateName?.toLowerCase().includes(term) ||
      app.candidateEmail?.toLowerCase().includes(term) ||
      app.openingTitle?.toLowerCase().includes(term) ||
      app.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            Hiring Manager Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contract openings assigned to you. Review submitted vendor profiles and AI candidate recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </button>
          <button
            onClick={() => {
              handleFetchOpenings({ forceRefresh: true });
              fetchApplications();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isAppsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "contracts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          My Contract Openings ({openings.length})
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "applications"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          All Applications ({applications.length})
        </button>
      </div>

      {/* Error banner */}
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeTab === "contracts"
              ? "Filter your openings by title or skills..."
              : "Search candidates, email, or contract role..."
          }
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Tab 1: Contract Openings */}
      {activeTab === "contracts" && (
        <>
          {isLoading && openings.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl border border-border bg-card animate-pulse space-y-3"
                >
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-16 bg-muted rounded w-full" />
                </div>
              ))}
            </div>
          ) : filteredOpenings.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card space-y-3">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
              <h3 className="text-lg font-semibold text-foreground">No openings found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                You do not currently have any active openings assigned, or none matched your filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOpenings.map((opening) => (
                <div
                  key={opening.id}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                        {opening.contractType || "CONTRACT"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            opening.status === "OPEN"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : opening.status === "ON_HOLD"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {opening.status || "OPEN"}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditOpening(opening);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Update Status"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h2
                      onClick={() => router.push(`/hiring-manager/openings/${opening.id}`)}
                      className="text-lg font-bold text-foreground group-hover:text-primary transition-colors cursor-pointer"
                    >
                      {opening.title}
                    </h2>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {opening.description}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {(opening.skillsRequired || ["Full Stack", "TypeScript"]).slice(0, 4).map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 text-[11px] rounded bg-muted text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {opening.location || "Remote"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {opening.minExperienceYears || opening.experienceMin || 0}+ yrs exp
                      </span>
                    </div>
                    <div
                      onClick={() => router.push(`/hiring-manager/openings/${opening.id}`)}
                      className="flex items-center justify-between pt-1 cursor-pointer"
                    >
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        {opening.profilesCount ?? opening._count?.hiringProfiles ?? 0} Candidate Submissions
                      </span>
                      <span className="flex items-center gap-0.5 text-primary font-semibold group-hover:translate-x-0.5 transition-transform">
                        Evaluate <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: All Candidate Applications Overview */}
      {activeTab === "applications" && (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                All Candidate Applications ({filteredApplications.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every candidate submitted by IT vendors across all your contract requisitions.
              </p>
            </div>
          </div>

          {isAppsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading applications...</div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border bg-muted/20">
              <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-50 mb-2" />
              <p className="text-sm font-medium text-foreground">No candidate applications found</p>
              <p className="text-xs text-muted-foreground mt-1">
                When vendors submit candidates to your contracts, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Contract Opening</th>
                    <th className="px-4 py-3">Match Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{app.candidateName}</div>
                        <div className="text-[11px] text-muted-foreground">{app.candidateEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {app.openingTitle}
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          {app.contractType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {app.score !== null ? (
                          <span
                            className={
                              app.score >= 75
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : app.score >= 50
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : "text-rose-600 dark:text-rose-400 font-bold"
                            }
                          >
                            {app.score}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal">Evaluating...</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            app.status === "SHORTLISTED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : app.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => router.push(`/hiring-manager/openings/${app.openingId}`)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                        >
                          Evaluate <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Contract Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Create New Contract Requisition</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Contract Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Cloud Architect"
                  value={newOpening.title}
                  onChange={(e) => setNewOpening({ ...newOpening, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Contract Type</label>
                  <select
                    value={newOpening.contractType}
                    onChange={(e) => setNewOpening({ ...newOpening, contractType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  >
                    <option value="C2C">C2C</option>
                    <option value="W2 Contract">W2 Contract</option>
                    <option value="1099">1099 Independent</option>
                    <option value="Part-Time Contract">Part-Time Contract</option>
                    <option value="Full-Time Contract">Full-Time Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={newOpening.location}
                    onChange={(e) => setNewOpening({ ...newOpening, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Min Experience (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={newOpening.experienceMin}
                    onChange={(e) => setNewOpening({ ...newOpening, experienceMin: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Max Experience (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    value={newOpening.experienceMax}
                    onChange={(e) => setNewOpening({ ...newOpening, experienceMax: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Description & Requirements</label>
                <textarea
                  rows="3"
                  placeholder="Key responsibilities and required technologies..."
                  value={newOpening.description}
                  onChange={(e) => setNewOpening({ ...newOpening, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCreating ? "Publishing..." : "Publish Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contract Status Modal */}
      {editOpening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-base font-bold text-foreground">Update Contract Status</h3>
              <button
                onClick={() => setEditOpening(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Update status for <strong className="text-foreground">{editOpening.title}</strong>:
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => handleStatusUpdate("OPEN")}
                disabled={isUpdatingStatus}
                className={`py-2 px-3 text-xs rounded-lg font-semibold border ${
                  editOpening.status === "OPEN"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-600"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                OPEN
              </button>
              <button
                onClick={() => handleStatusUpdate("ON_HOLD")}
                disabled={isUpdatingStatus}
                className={`py-2 px-3 text-xs rounded-lg font-semibold border ${
                  editOpening.status === "ON_HOLD"
                    ? "bg-amber-500/20 border-amber-500 text-amber-600"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                ON HOLD
              </button>
              <button
                onClick={() => handleStatusUpdate("CLOSED")}
                disabled={isUpdatingStatus}
                className={`py-2 px-3 text-xs rounded-lg font-semibold border ${
                  editOpening.status === "CLOSED"
                    ? "bg-rose-500/20 border-rose-500 text-rose-600"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                CLOSED
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
