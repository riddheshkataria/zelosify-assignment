import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/utils/Axios/AxiosInstance";

/**
 * Async thunk: Fetch tenant openings accessible to the logged-in IT Vendor.
 * Supports query params: page, limit, search, status, contractType.
 */
export const fetchVendorOpenings = createAsyncThunk(
  "vendorOpenings/fetchVendorOpenings",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/vendor/openings", { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch vendor openings"
      );
    }
  }
);

/**
 * Async thunk: Fetch single opening details and vendor's uploaded candidate profiles.
 */
export const fetchVendorOpeningDetails = createAsyncThunk(
  "vendorOpenings/fetchVendorOpeningDetails",
  async (openingId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/vendor/openings/${openingId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch opening details"
      );
    }
  }
);

/**
 * Async thunk: Request presigned S3 upload URLs for resume files.
 * payload: { openingId, files: [{ filename, contentType }] }
 */
export const presignVendorUploads = createAsyncThunk(
  "vendorOpenings/presignVendorUploads",
  async ({ openingId, files }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/vendor/openings/${openingId}/presign-upload`,
        { files }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to generate upload URLs"
      );
    }
  }
);

/**
 * Async thunk: Submit candidate profiles with uploaded resume S3 keys for AI evaluation.
 * payload: { openingId, profiles: [...] }
 */
export const submitVendorProfiles = createAsyncThunk(
  "vendorOpenings/submitVendorProfiles",
  async ({ openingId, profiles }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/vendor/openings/${openingId}/submit-profiles`,
        { profiles }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to submit candidate profiles"
      );
    }
  }
);

/**
 * Async thunk: Soft delete an uploaded profile owned by this vendor.
 * payload: { openingId, profileId }
 */
export const softDeleteVendorProfile = createAsyncThunk(
  "vendorOpenings/softDeleteVendorProfile",
  async ({ openingId, profileId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(
        `/vendor/openings/${openingId}/profiles/${profileId}`
      );
      return { profileId, message: response.data.message };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete profile"
      );
    }
  }
);

const initialState = {
  // Data states
  openings: [],
  currentOpening: null,
  uploadedProfiles: [],

  // UI / Status states
  isLoading: false,
  isSubmitting: false,
  isDeleting: false,
  error: null,
  successMessage: null,

  // Pagination & filter states
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    contractType: "",
    status: "",
  },
};

const vendorOpeningsSlice = createSlice({
  name: "vendorOpenings",
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    resetCurrentOpening: (state) => {
      state.currentOpening = null;
      state.uploadedProfiles = [];
    },
    resetVendorOpenings: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch openings list
      .addCase(fetchVendorOpenings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchVendorOpenings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openings = action.payload.data || [];
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(fetchVendorOpenings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch opening details
      .addCase(fetchVendorOpeningDetails.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchVendorOpeningDetails.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOpening = action.payload.data?.opening || null;
        state.uploadedProfiles = action.payload.data?.uploadedProfiles || [];
      })
      .addCase(fetchVendorOpeningDetails.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Submit profiles
      .addCase(submitVendorProfiles.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(submitVendorProfiles.fulfilled, (state, action) => {
        state.isSubmitting = false;
        const newProfiles = action.payload.data?.profiles || [];
        // Append newly created profiles
        state.uploadedProfiles = [...state.uploadedProfiles, ...newProfiles];
        state.successMessage =
          action.payload.message || "Candidate profiles submitted successfully";
      })
      .addCase(submitVendorProfiles.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      })

      // Soft delete profile
      .addCase(softDeleteVendorProfile.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(softDeleteVendorProfile.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.uploadedProfiles = state.uploadedProfiles.filter(
          (p) => p.id !== action.payload.profileId
        );
        state.successMessage = action.payload.message || "Profile deleted successfully";
      })
      .addCase(softDeleteVendorProfile.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload;
      });
  },
});

export const {
  setFilters,
  clearError,
  clearSuccessMessage,
  resetCurrentOpening,
  resetVendorOpenings,
} = vendorOpeningsSlice.actions;

// Selectors
export const selectVendorOpenings = (state) => state.vendorOpenings.openings;
export const selectCurrentOpening = (state) => state.vendorOpenings.currentOpening;
export const selectVendorProfiles = (state) => state.vendorOpenings.uploadedProfiles;
export const selectVendorLoading = (state) => state.vendorOpenings.isLoading;
export const selectVendorSubmitting = (state) => state.vendorOpenings.isSubmitting;
export const selectVendorDeleting = (state) => state.vendorOpenings.isDeleting;
export const selectVendorError = (state) => state.vendorOpenings.error;
export const selectVendorSuccess = (state) => state.vendorOpenings.successMessage;
export const selectVendorPagination = (state) => state.vendorOpenings.pagination;
export const selectVendorFilters = (state) => state.vendorOpenings.filters;

export default vendorOpeningsSlice.reducer;
