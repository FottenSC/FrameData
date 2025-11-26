import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface UserSettingsContextType {
    gameTranslations: Record<string, string[]>;
    getEnabledTranslations: (gameId: string, defaults?: string[]) => string[];
    toggleGameTranslation: (gameId: string, key: string, currentEnabled: string[]) => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

interface UserSettingsProviderProps {
    children: ReactNode;
}

export const UserSettingsProvider: React.FC<UserSettingsProviderProps> = ({ children }) => {
    const [gameTranslations, setGameTranslations] = useState<Record<string, string[]>>(() => {
        const saved = localStorage.getItem("gameTranslations");
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem("gameTranslations", JSON.stringify(gameTranslations));
    }, [gameTranslations]);

    const getEnabledTranslations = (gameId: string, defaults: string[] = []) => {
        return gameTranslations[gameId] ?? defaults;
    };

    const toggleGameTranslation = (gameId: string, key: string, currentEnabled: string[]) => {
        setGameTranslations((prev) => {
            const isEnabled = currentEnabled.includes(key);
            const newEnabled = isEnabled
                ? currentEnabled.filter((k) => k !== key)
                : [...currentEnabled, key];

            return { ...prev, [gameId]: newEnabled };
        });
    };

    return (
        <UserSettingsContext.Provider value={{ gameTranslations, getEnabledTranslations, toggleGameTranslation }}>
            {children}
        </UserSettingsContext.Provider>
    );
};

export const useUserSettings = (): UserSettingsContextType => {
    const context = useContext(UserSettingsContext);
    if (context === undefined) {
        throw new Error("useUserSettings must be used within a UserSettingsProvider");
    }
    return context;
};
