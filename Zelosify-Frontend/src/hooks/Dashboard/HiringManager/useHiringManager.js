import { useSelector, useDispatch } from "react-redux";
import { useCallback, useRef } from "react";
import {
  fetchManagerOpenings,
  fetchOpeningProfiles,
  shortlistCandidate,
  rejectCandidate,
  fetchProfilePreview,
  setFilterBadge,
  setFilterStatus,
  setSearchQuery,
  clearError,
  clearSuccessMessage,
  clearPreview,
  resetHiringManager,
  selectManagerOpenings,
  selectManagerCurrentOpening,
  selectManagerProfiles,
  selectManagerLoading,
  selectManagerActionLoading,
  selectPreviewLoading,
  selectProfilePreviewData,
  selectManagerError,
  selectManagerSuccess,
  selectFilterBadge,
  selectFilterStatus,
  selectSearchQuery,
} from "@/redux/features/HiringManager/hiringManagerSlice";

/**
 * Custom hook for Hiring Manager candidate review, evaluation and action flows.
 * Adheres to Zelosify Redux standards: memoized callbacks, duplicate request prevention,
 * optimistic updates, and clean state access.
 */
const useHiringManager = () => {
  const dispatch = useDispatch();
  const hasFetchedOpeningsRef = useRef(false);
  const lastFetchedOpeningIdRef = useRef(null);

  // State selectors
  const openings = useSelector(selectManagerOpenings);
  const currentOpening = useSelector(selectManagerCurrentOpening);
  const profiles = useSelector(selectManagerProfiles);
  const isLoading = useSelector(selectManagerLoading);
  const isActionLoading = useSelector(selectManagerActionLoading);
  const previewLoading = useSelector(selectPreviewLoading);
  const previewData = useSelector(selectProfilePreviewData);
  const error = useSelector(selectManagerError);
  const successMessage = useSelector(selectManagerSuccess);
  const filterBadge = useSelector(selectFilterBadge);
  const filterStatus = useSelector(selectFilterStatus);
  const searchQuery = useSelector(selectSearchQuery);

  /**
   * Fetch openings owned by this Hiring Manager.
   */
  const handleFetchOpenings = useCallback(
    async (params = {}) => {
      if (hasFetchedOpeningsRef.current && !params.forceRefresh) return;
      try {
        await dispatch(fetchManagerOpenings(params)).unwrap();
        hasFetchedOpeningsRef.current = true;
      } catch (err) {
        console.error("Failed to fetch hiring manager openings:", err);
      }
    },
    [dispatch]
  );

  /**
   * Fetch candidate profiles with AI scores for a specific opening.
   */
  const handleFetchProfiles = useCallback(
    async (openingId, force = false) => {
      if (!openingId) return;
      if (lastFetchedOpeningIdRef.current === openingId && !force) return;
      try {
        await dispatch(fetchOpeningProfiles(openingId)).unwrap();
        lastFetchedOpeningIdRef.current = openingId;
      } catch (err) {
        console.error("Failed to fetch candidate profiles:", err);
      }
    },
    [dispatch]
  );

  /**
   * Shortlist candidate profile.
   */
  const handleShortlist = useCallback(
    async (openingId, profileId) => {
      try {
        await dispatch(shortlistCandidate({ openingId, profileId })).unwrap();
      } catch (err) {
        console.error("Failed to shortlist candidate:", err);
      }
    },
    [dispatch]
  );

  /**
   * Reject candidate profile.
   */
  const handleReject = useCallback(
    async (openingId, profileId) => {
      try {
        await dispatch(rejectCandidate({ openingId, profileId })).unwrap();
      } catch (err) {
        console.error("Failed to reject candidate:", err);
      }
    },
    [dispatch]
  );

  /**
   * Fetch presigned preview URL for a candidate's resume.
   */
  const handleFetchPreview = useCallback(
    async (openingId, profileId) => {
      try {
        return await dispatch(
          fetchProfilePreview({ openingId, profileId })
        ).unwrap();
      } catch (err) {
        console.error("Failed to fetch resume preview:", err);
        return null;
      }
    },
    [dispatch]
  );

  /**
   * Filtering actions.
   */
  const handleSetFilterBadge = useCallback(
    (badge) => {
      dispatch(setFilterBadge(badge));
    },
    [dispatch]
  );

  const handleSetFilterStatus = useCallback(
    (status) => {
      dispatch(setFilterStatus(status));
    },
    [dispatch]
  );

  const handleSetSearchQuery = useCallback(
    (query) => {
      dispatch(setSearchQuery(query));
    },
    [dispatch]
  );

  /**
   * Clear error state.
   */
  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  /**
   * Clear success banner message.
   */
  const handleClearSuccess = useCallback(() => {
    dispatch(clearSuccessMessage());
  }, [dispatch]);

  /**
   * Clear preview modal data.
   */
  const handleClearPreview = useCallback(() => {
    dispatch(clearPreview());
  }, [dispatch]);

  /**
   * Reset hiring manager state.
   */
  const handleReset = useCallback(() => {
    dispatch(resetHiringManager());
    hasFetchedOpeningsRef.current = false;
    lastFetchedOpeningIdRef.current = null;
  }, [dispatch]);

  return {
    // State
    openings,
    currentOpening,
    profiles,
    isLoading,
    isActionLoading,
    previewLoading,
    previewData,
    error,
    successMessage,
    filterBadge,
    filterStatus,
    searchQuery,

    // Actions
    handleFetchOpenings,
    handleFetchProfiles,
    handleShortlist,
    handleReject,
    handleFetchPreview,
    handleSetFilterBadge,
    handleSetFilterStatus,
    handleSetSearchQuery,
    handleClearError,
    handleClearSuccess,
    handleClearPreview,
    handleReset,
  };
};

export default useHiringManager;
