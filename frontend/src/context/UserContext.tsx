import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';

interface UserData {
    position: string | null;
    experience_level: string | null;
    resumeLink: string | null;
}

interface UserContextType {
    userData: UserData | null;
    loading: boolean;
    error: Error | null;
}

const UserContext = createContext<UserContextType>({
    userData: null,
    loading: true,
    error: null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    useEffect(() => {
        const fetchUserData = async () => {
            if (!isLoaded) return;
            
            if (!isSignedIn) {
                setLoading(false);
                return;
            }

            try {
                const token = await getToken();
                if (!token) {
                    setLoading(false);
                    return;
                }

                const response = await axios.get(`${backendUrl}/api/users/check`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                setUserData(response.data.data);
            } catch (err) {
                setError(err as Error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [isLoaded, isSignedIn, getToken, backendUrl]);

    return (
        <UserContext.Provider value={{ userData, loading, error }}>
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext); 