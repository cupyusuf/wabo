import type { AuthenticationState } from 'baileys';
export declare function usePostgresAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}>;
