const API_BASE_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:5000";

interface AuthResponse {
  _id: string;
  name: string;
  email: string;
}

interface ErrorResponse {
  error: string;
}

class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      (data as ErrorResponse).error || "Something went wrong",
      response.status,
    );
  }

  return data as T;
}

export const authApi = {
  signup: async (name: string, email: string, password: string) => {
    return fetchApi<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  signin: async (email: string, password: string) => {
    return fetchApi<AuthResponse>("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  signout: async () => {
    return fetchApi<{ message: string }>("/api/auth/signout", {
      method: "POST",
    });
  },

  getMe: async () => {
    return fetchApi<AuthResponse>("/api/auth/me", {
      method: "GET",
    });
  },
};

export { ApiError };
