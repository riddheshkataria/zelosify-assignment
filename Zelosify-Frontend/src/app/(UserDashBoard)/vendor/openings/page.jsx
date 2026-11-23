"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  Calendar,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertCircle,
  FileText,
} from "lucide-react";
import useVendorOpenings from "@/hooks/Dashboard/Vendor/useVendorOpenings";

export default function VendorOpeningsPage() {
  const router = useRouter();
  const {
    openings,
    isLoading,
    error,
    pagination,
    handleFetchOpenings,
    handleClearError,
  } = useVendorOpenings();

  const [search, setSearch] = useState("");
  const [contractType, setContractType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    handleFetchOpenings({
      page: currentPage,
      limit: 10,
      search: search.trim() || undefined,
      contractType: contractType || undefined,
      forceRefresh: true,
    });
  }, [handleFetchOpenings, currentPage, search, contractType]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleContractTypeChange = (e) => {
    setContractType(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            Contract Openings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse active contract openings for your tenant and submit qualified candidate profiles.
          </p>
        </div>
        <button
          onClick={() =>
            handleFetchOpenings({
              page: currentPage,
              limit: 10,
              search: search.trim() || undefined,
              contractType: contractType || undefined,
              forceRefresh: true,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
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

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search openings by title, description or skills..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <select
            value={contractType}
            onChange={handleContractTypeChange}
            className="px-3.5 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All Contract Types</option>
            <option value="C2C">C2C (Corp-to-Corp)</option>
            <option value="W2">W2 Contract</option>
            <option value="1099">1099 Independent</option>
            <option value="Part-Time">Part-Time Contract</option>
            <option value="Full-Time">Full-Time Contract</option>
          </select>
        </div>
      </div>

      {/* Openings Grid / Table */}
      {isLoading && openings.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-border bg-card animate-pulse space-y-3"
            >
              <div className="h-5 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-16 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : openings.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card space-y-3">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-lg font-semibold text-foreground">No openings found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            No active contract openings match your current search criteria. Try clearing filters or check back later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {openings.map((opening) => (
            <div
              key={opening.id}
              onClick={() => router.push(`/vendor/openings/${opening.id}`)}
              className="group cursor-pointer p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {opening.title}
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {opening.contractType || "CONTRACT"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {opening.description}
                </p>

                {/* Key Skills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(opening.skillsRequired || []).slice(0, 5).map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                  {(opening.skillsRequired || []).length > 5 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{opening.skillsRequired.length - 5} more
                    </span>
                  )}
                </div>
              </div>

              {/* Meta footer */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {opening.location || "Remote"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {opening.minExperienceYears || 0}+ yrs exp
                  </span>
                </div>
                <div className="flex items-center gap-1 font-medium text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>Submit Resumes</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing Page <span className="font-semibold text-foreground">{pagination.page}</span> of{" "}
            <span className="font-semibold text-foreground">{pagination.totalPages}</span> (
            {pagination.total} openings)
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
