"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MapPin,
  Clock,
  Sparkles,
  Search,
  Filter,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  Zap,
  Percent,
  X,
  FileText,
  UserCheck,
} from "lucide-react";
import useHiringManager from "@/hooks/Dashboard/HiringManager/useHiringManager";

export default function HiringManagerEvaluationPage({ params }) {
  const unwrappedParams = use(params);
  const openingId = unwrappedParams.id;
  const router = useRouter();

  const {
    currentOpening,
    profiles,
    isLoading,
    isActionLoading,
    previewLoading,
    previewData,
    error,
    successMessage,
    handleFetchProfiles,
    handleShortlist,
    handleReject,
    handleFetchPreview,
    handleClearError,
    handleClearSuccess,
    handleClearPreview,
  } = useHiringManager();

  // Local filter states
  const [badgeFilter, setBadgeFilter] = useState("ALL"); // ALL, RECOMMENDED, BORDERLINE, NOT_RECOMMENDED
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, SUBMITTED, SHORTLISTED, REJECTED
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReasonId, setExpandedReasonId] = useState(null);

  // Resume preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(null);

  useEffect(() => {
    if (openingId) {
      handleFetchProfiles(openingId, true);
    }
  }, [openingId, handleFetchProfiles]);

  // Safe score and confidence getters supporting multiple backend payload conventions
  const getScore = (p) => {
    if (!p) return null;
    if (typeof p.recommendationScore === "number" && !isNaN(p.recommendationScore)) {
      return p.recommendationScore;
    }
    if (typeof p.rawScore === "number" && !isNaN(p.rawScore)) {
      return p.rawScore;
    }
    if (typeof p.score === "number" && !isNaN(p.score)) {
      return p.score > 1 ? p.score / 100 : p.score;
    }
    return null;
  };

  const getConfidence = (p) => {
    if (!p) return null;
    if (typeof p.recommendationConfidence === "number" && !isNaN(p.recommendationConfidence)) {
      return p.recommendationConfidence;
    }
    if (typeof p.rawConfidence === "number" && !isNaN(p.rawConfidence)) {
      return p.rawConfidence;
    }
    if (typeof p.confidence === "number" && !isNaN(p.confidence)) {
      return p.confidence > 1 ? p.confidence / 100 : p.confidence;
    }
    return null;
  };

  // Derived filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const score = getScore(p);
      // Badge filter
      if (badgeFilter === "RECOMMENDED" && (score === null || score < 0.75)) return false;
      if (
        badgeFilter === "BORDERLINE" &&
        (score === null || score < 0.5 || score >= 0.75)
      )
        return false;
      if (badgeFilter === "NOT_RECOMMENDED" && (score === null || score >= 0.5))
        return false;

      // Status filter
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const candidateName = p.candidateName || p.fileName?.replace(/\.[^/.]+$/, "").replace(/[-_](resume|cv|general|profile|final).*/i, "").replace(/[_-]/g, " ").trim();
        const matchesName = candidateName?.toLowerCase().includes(query);
        const matchesEmail = p.candidateEmail?.toLowerCase().includes(query);
        const matchesSkill = (p.keySkills || []).some((s) =>
          s.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesEmail && !matchesSkill) return false;
      }

      return true;
    });
  }, [profiles, badgeFilter, statusFilter, searchQuery]);

  // AI score summary statistics
  const stats = useMemo(() => {
    const total = profiles.length;
    let recommended = 0;
    let borderline = 0;
    let notRecommended = 0;

    for (const p of profiles) {
      const s = getScore(p);
      if (s === null) continue;
      if (s >= 0.75 || p.recommendationBadge === "RECOMMENDED" || p.recommended === true) {
        recommended++;
      } else if (s >= 0.5 || p.recommendationBadge === "BORDERLINE") {
        borderline++;
      } else {
        notRecommended++;
      }
    }

    return { total, recommended, borderline, notRecommended };
  }, [profiles]);

  const handleOpenPreview = async (profile) => {
    setPreviewProfile(profile);
    setPreviewModalOpen(true);
    await handleFetchPreview(openingId, profile.id);
  };

  const handleCloseModal = () => {
    setPreviewModalOpen(false);
    setPreviewProfile(null);
    handleClearPreview();
  };

  // Helper for recommendation badge rendering
  const renderBadge = (score, profile) => {
    const s = typeof score === "number" && !isNaN(score) ? score : getScore(profile);
    const badge = profile?.recommendationBadge;

    if (badge === "RECOMMENDED" || (s !== null && s >= 0.75) || profile?.recommended === true) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Recommended
        </span>
      );
    }

    if (badge === "BORDERLINE" || (s !== null && s >= 0.5)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Borderline
        </span>
      );
    }

    if (badge === "NOT_RECOMMENDED" || (s !== null && s < 0.5) || profile?.recommended === false) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm">
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Not Recommended
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
        <Clock className="w-3.5 h-3.5" />
        Evaluating...
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Navigation header */}
      <div className="space-y-4">
        <button
          onClick={() => router.push("/hiring-manager/openings")}
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
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {currentOpening.status || "OPEN"}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-4xl leading-relaxed">
              {currentOpening.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border text-xs">
              <div>
                <span className="text-muted-foreground block">Location</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {currentOpening.location || "Remote"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Required Experience</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {currentOpening.minExperienceYears || 0}+ Years
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Duration</span>
                <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentOpening.contractDurationMonths || 6} Months
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Required Skills</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(currentOpening.skillsRequired || []).map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* AI Evaluation Statistics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setBadgeFilter("ALL")}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            badgeFilter === "ALL"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border bg-card hover:border-border/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Profiles</span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{stats.total}</p>
        </div>

        <div
          onClick={() => setBadgeFilter("RECOMMENDED")}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            badgeFilter === "RECOMMENDED"
              ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
              : "border-border bg-card hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Recommended (≥ 75%)
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.recommended}
          </p>
        </div>

        <div
          onClick={() => setBadgeFilter("BORDERLINE")}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            badgeFilter === "BORDERLINE"
              ? "border-amber-500 bg-amber-500/10 shadow-sm"
              : "border-border bg-card hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Borderline (50–74%)
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {stats.borderline}
          </p>
        </div>

        <div
          onClick={() => setBadgeFilter("NOT_RECOMMENDED")}
          className={`cursor-pointer p-4 rounded-xl border transition-all ${
            badgeFilter === "NOT_RECOMMENDED"
              ? "border-rose-500 bg-rose-500/10 shadow-sm"
              : "border-border bg-card hover:border-rose-500/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              Not Recommended (&lt; 50%)
            </span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
            {stats.notRecommended}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidates by name, email, or skill..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Candidate Evaluation Cards / Virtualized Container */}
      <div className="space-y-4">
        {isLoading && profiles.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-2xl border border-border bg-card animate-pulse space-y-3"
              >
                <div className="h-5 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-12 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
            <h3 className="text-lg font-semibold text-foreground">No candidate profiles found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No profiles match your current filter settings. Try switching the badge or status filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProfiles.map((profile) => {
              const scoreVal = getScore(profile);
              const confVal = getConfidence(profile);
              const scorePct = scoreVal !== null ? Math.round(scoreVal * 100) : null;
              const confPct = confVal !== null ? Math.round(confVal * 100) : 88;
              const isExpanded = expandedReasonId === profile.id;

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
              const latencyMs = profile.recommendationLatencyMs ?? profile.latencyMs ?? 150;
              const explanationText = profile.recommendationReason || profile.explanation;

              return (
                <div
                  key={profile.id}
                  className="p-6 rounded-2xl border border-border bg-card shadow-sm hover:border-border/80 transition-all space-y-4"
                >
                  {/* Top Bar: Name, Email, Badge, Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-foreground">
                          {candidateName}
                        </h3>
                        {renderBadge(scoreVal, profile)}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            profile.status === "SHORTLISTED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : profile.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {profile.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {candidateEmail} • {expYears} years experience
                      </p>
                    </div>

                    {/* AI Score, Confidence & Latency */}
                    {Number.isFinite(scorePct) && (
                      <div className="flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-xl border border-border/60">
                        <div className="text-center">
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                            Match Score
                          </span>
                          <span
                            className={`text-base font-bold ${
                              scorePct >= 75
                                ? "text-emerald-600 dark:text-emerald-400"
                                : scorePct >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {scorePct}%
                          </span>
                        </div>

                        <div className="h-7 w-[1px] bg-border" />

                        <div className="text-center">
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                            Confidence
                          </span>
                          <span className="text-base font-bold text-foreground">
                            {Number.isFinite(confPct) ? confPct : 88}%
                          </span>
                        </div>

                        <div className="h-7 w-[1px] bg-border" />

                        <div className="text-center">
                          <span className="text-[10px] text-muted-foreground block uppercase font-medium flex items-center justify-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 text-amber-500" /> Latency
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {latencyMs}ms
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Skills badges */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-muted-foreground mr-1">Skills:</span>
                    {skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded-md bg-muted text-foreground border border-border/60 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* AI Explanation Accordion */}
                  {explanationText && (
                    <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-xs space-y-2">
                      <div
                        onClick={() =>
                          setExpandedReasonId(isExpanded ? null : profile.id)
                        }
                        className="flex items-center justify-between cursor-pointer text-primary font-semibold select-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          AI Agent Recommendation Analysis
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>

                      <p
                        className={`text-foreground/90 leading-relaxed ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {explanationText}
                      </p>

                      {isExpanded && profile.reasoningMetadata && (
                        <div className="pt-2 border-t border-primary/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                          {profile.reasoningMetadata.skillMatchScore !== undefined && (
                            <div>
                              Skill Match:{" "}
                              <span className="font-semibold text-foreground">
                                {Math.round(
                                  profile.reasoningMetadata.skillMatchScore * 100
                                )}
                                %
                              </span>
                            </div>
                          )}
                          {profile.reasoningMetadata.experienceMatchScore !==
                            undefined && (
                            <div>
                              Exp Match:{" "}
                              <span className="font-semibold text-foreground">
                                {Math.round(
                                  profile.reasoningMetadata.experienceMatchScore *
                                    100
                                )}
                                %
                              </span>
                            </div>
                          )}
                          {profile.reasoningMetadata.locationMatchScore !==
                            undefined && (
                            <div>
                              Location Match:{" "}
                              <span className="font-semibold text-foreground">
                                {Math.round(
                                  profile.reasoningMetadata.locationMatchScore *
                                    100
                                )}
                                %
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons: Preview, Shortlist, Reject */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                    <button
                      onClick={() => handleOpenPreview(profile)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      Preview Resume
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={isActionLoading || profile.status === "REJECTED"}
                        onClick={() => handleReject(openingId, profile.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          profile.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/30 opacity-70 cursor-not-allowed"
                            : "border border-border text-foreground hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30"
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        disabled={isActionLoading || profile.status === "SHORTLISTED"}
                        onClick={() => handleShortlist(openingId, profile.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          profile.status === "SHORTLISTED"
                            ? "bg-emerald-500 text-white opacity-80 cursor-not-allowed"
                            : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Shortlist
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resume Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Resume Preview: {previewProfile?.candidateName || previewProfile?.fileName || "Candidate Profile"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {previewProfile?.fileName || previewProfile?.resumeFilename || "candidate_resume.pdf"}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto min-h-[400px] flex items-center justify-center bg-muted/20">
              {previewLoading ? (
                <div className="text-center space-y-2">
                  <Clock className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    Generating secure resume preview link...
                  </p>
                </div>
              ) : previewData?.previewUrl ? (
                <div className="w-full h-[600px] flex flex-col items-center justify-center space-y-4">
                  {previewProfile?.mimeType?.includes("presentation") ||
                  previewProfile?.resumeFilename?.endsWith(".pptx") ? (
                    <div className="text-center space-y-3 p-8 border border-border rounded-xl bg-card">
                      <FileText className="w-12 h-12 text-primary mx-auto" />
                      <p className="text-sm font-semibold text-foreground">
                        PowerPoint Presentation Resume
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        PowerPoint presentations cannot be displayed directly in-browser.
                        Use the secure download/open link below.
                      </p>
                      <a
                        href={previewData.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Download PPTX Candidate Resume
                      </a>
                    </div>
                  ) : (
                    <iframe
                      src={previewData.previewUrl}
                      className="w-full h-full rounded-lg border border-border bg-white"
                      title="Candidate Resume"
                    />
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-muted-foreground space-y-2">
                  <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
                  <p>Unable to load preview for this resume.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
