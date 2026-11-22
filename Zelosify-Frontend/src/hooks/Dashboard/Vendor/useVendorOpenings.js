import { useSelector, useDispatch } from "react-redux";
import { useCallback, useRef } from "react";
import {
  fetchVendorOpenings,
  fetchVendorOpeningDetails,
  presignVendorUploads,
  submitVendorProfiles,
  softDeleteVendorProfile,
  setFilters,
  clearError,
  clearSuccessMessage,
  resetCurrentOpening,
  resetVendorOpenings,
  selectVendorOpenings,
  selectCurrentOpening,
  selectVendorProfiles,
  selectVendorLoading,
  selectVendorSubmitting,
  selectVendorDeleting,
  selectVendorError,
  selectVendorSuccess,
  selectVendorPagination,
  selectVendorFilters,
} from "@/redux/features/Vendor/vendorOpeningsSlice";

/**
 * Custom hook for managing IT Vendor openings and candidate profile submissions.
 * Follows Zelosify Redux standards: memoized callbacks, duplicate request prevention,
 * full error handling, and clean selector interface.
 */
const useVendorOpenings = () => {
  const dispatch = useDispatch();
  const hasFetchedOpeningsRef = useRef(false);
  const lastFetchedOpeningIdRef = useRef(null);

  // State selectors
  const openings = useSelector(selectVendorOpenings);
  const currentOpening = useSelector(selectCurrentOpening);
  const uploadedProfiles = useSelector(selectVendorProfiles);
  const isLoading = useSelector(selectVendorLoading);
  const isSubmitting = useSelector(selectVendorSubmitting);
  const isDeleting = useSelector(selectVendorDeleting);
  const error = useSelector(selectVendorError);
  const successMessage = useSelector(selectVendorSuccess);
  const pagination = useSelector(selectVendorPagination);
  const filters = useSelector(selectVendorFilters);

  /**
   * Fetch tenant openings accessible to IT Vendor with duplicate check prevention.
   */
  const handleFetchOpenings = useCallback(
    async (params = {}) => {
      if (hasFetchedOpeningsRef.current && !params.forceRefresh) return;
      try {
        await dispatch(fetchVendorOpenings(params)).unwrap();
        hasFetchedOpeningsRef.current = true;
      } catch (err) {
        console.error("Failed to fetch vendor openings:", err);
      }
    },
    [dispatch]
  );

  /**
   * Fetch specific opening details and current vendor's uploaded profiles.
   */
  const handleFetchOpeningDetails = useCallback(
    async (openingId, force = false) => {
      if (!openingId) return;
      if (lastFetchedOpeningIdRef.current === openingId && !force) return;
      try {
        await dispatch(fetchVendorOpeningDetails(openingId)).unwrap();
        lastFetchedOpeningIdRef.current = openingId;
      } catch (err) {
        console.error("Failed to fetch opening details:", err);
      }
    },
    [dispatch]
  );

  /**
   * Request presigned upload URLs for candidate resumes.
   */
  const handlePresignUploads = useCallback(
    async (openingId, files) => {
      return await dispatch(
        presignVendorUploads({ openingId, files })
      ).unwrap();
    },
    [dispatch]
  );

  /**
   * Submit candidate profiles metadata & S3 keys.
   */
  const handleSubmitProfiles = useCallback(
    async (openingId, profiles) => {
      return await dispatch(
        submitVendorProfiles({ openingId, profiles })
      ).unwrap();
    },
    [dispatch]
  );

  /**
   * Soft delete a candidate profile uploaded by this vendor.
   */
  const handleDeleteProfile = useCallback(
    async (openingId, profileId) => {
      return await dispatch(
        softDeleteVendorProfile({ openingId, profileId })
      ).unwrap();
    },
    [dispatch]
  );

  /**
   * Set filter parameters.
   */
  const handleSetFilters = useCallback(
    (newFilters) => {
      dispatch(setFilters(newFilters));
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
   * Reset current opening view state.
   */
  const handleResetCurrentOpening = useCallback(() => {
    dispatch(resetCurrentOpening());
    lastFetchedOpeningIdRef.current = null;
  }, [dispatch]);

  /**
   * Reset full vendor state.
   */
  const handleResetVendor = useCallback(() => {
    dispatch(resetVendorOpenings());
    hasFetchedOpeningsRef.current = false;
    lastFetchedOpeningIdRef.current = null;
  }, [dispatch]);

  return {
    // State
    openings,
    currentOpening,
    uploadedProfiles,
    isLoading,
    isSubmitting,
    isDeleting,
    error,
    successMessage,
    pagination,
    filters,

    // Actions
    handleFetchOpenings,
    handleFetchOpeningDetails,
    handlePresignUploads,
    handleSubmitProfiles,
    handleDeleteProfile,
    handleSetFilters,
    handleClearError,
    handleClearSuccess,
    handleResetCurrentOpening,
    handleResetVendor,
  };
};

export default useVendorOpenings;
