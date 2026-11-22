import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/utils/Axios/AxiosInstance";

/**
 * Async thunk: Fetch openings owned by the logged-in Hiring Manager.
 */
export const fetchManagerOpenings = createAsyncThunk(
  "hiringManager/fetchManagerOpenings",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/hiring/openings", { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch hiring manager openings"
      );
    }
  }
);

/**
 * Async thunk: Fetch all submitted candidate profiles for an opening, including AI recommendation scores.
 */
export const fetchOpeningProfiles = createAsyncThunk(
  "hiringManager/fetchOpeningProfiles",
  async (openingId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `/hiring/openings/${openingId}/profiles`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch candidate profiles"
      );
    }
  }
);

/**
 * Async thunk: Shortlist a candidate profile.
 * payload: { openingId, profileId }
 */
export const shortlistCandidate = createAsyncThunk(
  "hiringManager/shortlistCandidate",
  async ({ openingId, profileId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/hiring/openings/${openingId}/profiles/${profileId}/shortlist`
      );
      return { profileId, profile: response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to shortlist candidate"
      );
    }
  }
);

/**
 * Async thunk: Reject a candidate profile.
 * payload: { openingId, profileId }
 */
export const rejectCandidate = createAsyncThunk(
  "hiringManager/rejectCandidate",
  async ({ openingId, profileId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/hiring/openings/${openingId}/profiles/${profileId}/reject`
      );
      return { profileId, profile: response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to reject candidate"
      );
    }
  }
);

/**
 * Async thunk: Fetch presigned preview URL for candidate resume.
 * payload: { openingId, profileId }
 */
export const fetchProfilePreview = createAsyncThunk(
  "hiringManager/fetchProfilePreview",
  async ({ openingId, profileId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `/hiring/openings/${openingId}/profiles/${profileId}/preview`
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to generate resume preview link"
      );
    }
  }
);

const initialState = {
  // Data states
  openings: [],
  currentOpening: null,
  profiles: [],
  previewData: null,

  // UI / Status states
  isLoading: false,
  isActionLoading: false,
  previewLoading: false,
  error: null,
  successMessage: null,

  // Filters
  filterBadge: "ALL", // "ALL" | "RECOMMENDED" | "BORDERLINE" | "NOT_RECOMMENDED"
  filterStatus: "ALL", // "ALL" | "SUBMITTED" | "SHORTLISTED" | "REJECTED"
  searchQuery: "",
};

const hiringManagerSlice = createSlice({
  name: "hiringManager",
  initialState,
  reducers: {
    setFilterBadge: (state, action) => {
      state.filterBadge = action.payload;
    },
    setFilterStatus: (state, action) => {
      state.filterStatus = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    clearPreview: (state) => {
      state.previewData = null;
    },
    resetHiringManager: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch openings
      .addCase(fetchManagerOpenings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchManagerOpenings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.openings = action.payload.data || [];
      })
      .addCase(fetchManagerOpenings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch profiles
      .addCase(fetchOpeningProfiles.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOpeningProfiles.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOpening = action.payload.data?.opening || null;
        state.profiles = action.payload.data?.profiles || [];
      })
      .addCase(fetchOpeningProfiles.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Shortlist candidate (optimistic update support)
      .addCase(shortlistCandidate.pending, (state, action) => {
        state.isActionLoading = true;
        const targetId = action.meta.arg.profileId;
        const profile = state.profiles.find((p) => p.id === targetId);
        if (profile) {
          profile.status = "SHORTLISTED";
        }
      })
      .addCase(shortlistCandidate.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const index = state.profiles.findIndex(
          (p) => p.id === action.payload.profileId
        );
        if (index !== -1 && action.payload.profile) {
          state.profiles[index] = {
            ...state.profiles[index],
            ...action.payload.profile,
          };
        }
        state.successMessage = "Candidate shortlisted successfully";
      })
      .addCase(shortlistCandidate.rejected, (state, action) => {
        state.isActionLoading = false;
        state.error = action.payload;
        // Revert to SUBMITTED if needed
        const targetId = action.meta.arg.profileId;
        const profile = state.profiles.find((p) => p.id === targetId);
        if (profile && profile.status === "SHORTLISTED") {
          profile.status = "SUBMITTED";
        }
      })

      // Reject candidate (optimistic update support)
      .addCase(rejectCandidate.pending, (state, action) => {
        state.isActionLoading = true;
        const targetId = action.meta.arg.profileId;
        const profile = state.profiles.find((p) => p.id === targetId);
        if (profile) {
          profile.status = "REJECTED";
        }
      })
      .addCase(rejectCandidate.fulfilled, (state, action) => {
        state.isActionLoading = false;
        const index = state.profiles.findIndex(
          (p) => p.id === action.payload.profileId
        );
        if (index !== -1 && action.payload.profile) {
          state.profiles[index] = {
            ...state.profiles[index],
            ...action.payload.profile,
          };
        }
        state.successMessage = "Candidate rejected";
      })
      .addCase(rejectCandidate.rejected, (state, action) => {
        state.isActionLoading = false;
        state.error = action.payload;
        // Revert to SUBMITTED if needed
        const targetId = action.meta.arg.profileId;
        const profile = state.profiles.find((p) => p.id === targetId);
        if (profile && profile.status === "REJECTED") {
          profile.status = "SUBMITTED";
        }
      })

      // Fetch preview
      .addCase(fetchProfilePreview.pending, (state) => {
        state.previewLoading = true;
      })
      .addCase(fetchProfilePreview.fulfilled, (state, action) => {
        state.previewLoading = false;
        state.previewData = action.payload;
      })
      .addCase(fetchProfilePreview.rejected, (state, action) => {
        state.previewLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setFilterBadge,
  setFilterStatus,
  setSearchQuery,
  clearError,
  clearSuccessMessage,
  clearPreview,
  resetHiringManager,
} = hiringManagerSlice.actions;

// Selectors
export const selectManagerOpenings = (state) => state.hiringManager.openings;
export const selectManagerCurrentOpening = (state) =>
  state.hiringManager.currentOpening;
export const selectManagerProfiles = (state) => state.hiringManager.profiles;
export const selectManagerLoading = (state) => state.hiringManager.isLoading;
export const selectManagerActionLoading = (state) =>
  state.hiringManager.isActionLoading;
export const selectPreviewLoading = (state) => state.hiringManager.previewLoading;
export const selectProfilePreviewData = (state) =>
  state.hiringManager.previewData;
export const selectManagerError = (state) => state.hiringManager.error;
export const selectManagerSuccess = (state) => state.hiringManager.successMessage;
export const selectFilterBadge = (state) => state.hiringManager.filterBadge;
export const selectFilterStatus = (state) => state.hiringManager.filterStatus;
export const selectSearchQuery = (state) => state.hiringManager.searchQuery;

export default hiringManagerSlice.reducer;
