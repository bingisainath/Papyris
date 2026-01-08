// import { AxiosError } from "axios";

// export function parseApiError(error: unknown): string {
//   if (!(error instanceof AxiosError)) {
//     return "Something went wrong. Please try again.";
//   }

//   const status = error.response?.status;
//   const detail = error.response?.data?.detail;

//   if (typeof detail === "string") {
//     return detail;
//   }

//   switch (status) {
//     case 400:
//       return "Invalid request data";
//     case 401:
//       return "Invalid email or password";
//     case 403:
//       return "Your account is inactive";
//     case 409:
//       return "User already exists";
//     case 422:
//       return "Please check the input fields";
//     case 500:
//       return "Server error. Please try later";
//     default:
//       return "Unexpected error occurred";
//   }
// }


import { AxiosError } from "axios";

export function parseApiError(error: unknown): string {
  if (!(error instanceof AxiosError)) {
    if (error instanceof Error) return error.message;
    return "Something went wrong. Please try again.";
  }

  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  const message = error.response?.data?.message;

  // Backend provides specific error message
  if (typeof detail === "string") return detail;
  if (typeof message === "string") return message;

  // Fallback based on status code
  switch (status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Invalid email or password.";
    case 403:
      return "Your account is inactive. Please contact support.";
    case 404:
      return "User not found. Please register first.";
    case 409:
      return "This email is already registered.";
    case 422:
      return "Please check the input fields.";
    case 500:
      return "Server error. Please try again later.";
    case 503:
      return "Service temporarily unavailable.";
    default:
      if (!status) return "Network error. Please check your connection.";
      return `Unexpected error (${status}). Please try again.`;
  }
}

// For field-specific validation errors
export function parseValidationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError)) return {};
  
  const detail = error.response?.data?.detail;
  
  // FastAPI validation errors format
  if (Array.isArray(detail)) {
    return detail.reduce((acc, err) => {
      const field = err.loc?.[err.loc.length - 1] || "general";
      acc[field] = err.msg || "Invalid value";
      return acc;
    }, {} as Record<string, string>);
  }
  
  return {};
}