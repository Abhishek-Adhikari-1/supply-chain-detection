const API_BASE_URL = "http://localhost:5000/api";

export interface ApiError {
    error: string;
}

export interface User {
    _id: string;
    name: string;
    email: string;
}

export interface SignupData {
    name: string;
    email: string;
    password: string;
}

export interface LoginData {
    email: string;
    password: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
    }
    return data as T;
}

export const authApi = {
    signup: async (data: SignupData): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(data),
        });
        return handleResponse<User>(response);
    },

    signin: async (data: LoginData): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(data),
        });
        return handleResponse<User>(response);
    },

    signout: async (): Promise<{ message: string }> => {
        const response = await fetch(`${API_BASE_URL}/auth/signout`, {
            method: "POST",
            credentials: "include",
        });
        return handleResponse<{ message: string }>(response);
    },

    getMe: async (): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
        });
        return handleResponse<User>(response);
    },
};
