"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import useHiringManager from "@/hooks/Dashboard/HiringManager/useHiringManager";

export default function HiringManagerOpeningsPage() {
  const router = useRouter();
  const {
    openings,
    isLoading,
    error,
    handleFetchOpenings,
    handleClearError,
  } = useHiringManager();

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    handleFetchOpenings({ forceRefresh: true });
  }, [handleFetchOpenings]);

  const filteredOpenings = openings.filter((op) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      op.title?.toLowerCase().includes(term) ||
      op.description?.toLowerCase().includes(term) ||
      (op.skillsRequired || []).some((s) => s.toLowerCase().includes(term))
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
        <button
          onClick={() => handleFetchOpenings({ forceRefresh: true })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
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
          placeholder="Filter your openings by title or skills..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Openings Grid */}
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
              onClick={() => router.push(`/hiring-manager/openings/${opening.id}`)}
              className="group cursor-pointer p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {opening.contractType || "CONTRACT"}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {opening.status || "OPEN"}
                  </span>
                </div>

                <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {opening.title}
                </h2>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {opening.description}
                </p>

                <div className="flex flex-wrap gap-1 pt-1">
                  {(opening.skillsRequired || []).slice(0, 4).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 text-[11px] rounded bg-muted text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                  {(opening.skillsRequired || []).length > 4 && (
                    <span className="text-[11px] text-muted-foreground self-center">
                      +{opening.skillsRequired.length - 4}
                    </span>
                  )}
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
                    {opening.minExperienceYears || 0}+ yrs exp
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {opening._count?.hiringProfiles ?? opening.candidateCount ?? 0} Candidate Submissions
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
    </div>
  );
}
