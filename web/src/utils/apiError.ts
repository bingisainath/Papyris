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


export const parseApiError = (err: any): string => {
  const data = err?.response?.data;

  // your new backend format
  if (data?.message) return data.message;

  // default FastAPI format
  if (data?.detail) return data.detail;

  // fallback
  return err?.message || "Something went wrong";
};
