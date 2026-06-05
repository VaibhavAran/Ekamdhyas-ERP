/**
 * Resolves the backend base URL for API requests.
 * Reads from the VITE_BACKEND_URL environment variable,
 * cleans any trailing slashes, and falls back to localhost if not specified.
 */
export const getBackendUrl = (): string => {
  const envUrl = (import.meta.env.VITE_BACKEND_URL || "").trim();
  
  if (!envUrl) {
    return "http://localhost:5000";
  }

  // Strip trailing slashes and return
  return envUrl.replace(/\/+$/, "");
};
