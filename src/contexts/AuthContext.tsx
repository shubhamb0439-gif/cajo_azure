import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { azureAuth, AzureUser, AuthSession } from '../lib/azureAuth';
import { api } from '../lib/api';

interface AuthContextType {
  user: AzureUser | null;
  userProfile: AzureUser | null;
  customerCompany: string | null;
  loading: boolean;
  hasWriteAccess: boolean;
  isManager: boolean;
  isClient: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AzureUser | null>(null);
  const [userProfile, setUserProfile] = useState<AzureUser | null>(null);
  const [customerCompany, setCustomerCompany] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCustomerCompany = useCallback(async (customerId: string) => {
    const { data } = await api.customers.getById(customerId);
    setCustomerCompany(data?.customer_company ?? null);
  }, []);

  const applySession = useCallback(
    async (session: AuthSession) => {
      if (!session.user.enabled) {
        await azureAuth.signOut();
        setUser(null);
        setUserProfile(null);
        setCustomerCompany(null);
        throw new Error('Your account is pending approval. Please contact an administrator.');
      }

      setUser(session.user);
      setUserProfile(session.user);

      if (session.user.customer_id) {
        await loadCustomerCompany(session.user.customer_id);
      } else {
        setCustomerCompany(null);
      }
    },
    [loadCustomerCompany]
  );

  const refreshProfile = useCallback(async () => {
    const session = azureAuth.getSession();
    if (!session) return;

    const { data } = await api.users.getByAuthId(session.user.auth_user_id);
    if (data) {
      const updated: AuthSession = {
        ...session,
        user: { ...session.user, ...data } as AzureUser,
      };
      azureAuth.saveSession(updated);
      setUser(updated.user);
      setUserProfile(updated.user);
      if (updated.user.customer_id) {
        await loadCustomerCompany(updated.user.customer_id);
      } else {
        setCustomerCompany(null);
      }
    }
  }, [loadCustomerCompany]);

  useEffect(() => {
    const initAuth = async () => {
      const session = azureAuth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        if (azureAuth.isTokenExpiringSoon()) {
          const { session: refreshed } = await azureAuth.refreshSession();
          if (refreshed) {
            await applySession(refreshed);
          } else {
            azureAuth.clearSession();
          }
        } else {
          await applySession(session);
        }
      } catch {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    };

    initAuth();
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { session, error } = await azureAuth.signIn(email, password);
    if (error || !session) throw new Error(error || 'Sign-in failed');

    if (!session.user.enabled) {
      await azureAuth.signOut();
      throw new Error('Your account is pending approval. Please contact an administrator.');
    }

    await api.activityLogs.create('SIGN_IN', { email });
    await applySession(session);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await azureAuth.signUp(email, password, name);
    if (error) throw new Error(error);
    throw new Error('Account created successfully. Please wait for administrator approval before signing in.');
  };

  const signOut = async () => {
    try {
      if (userProfile) {
        await api.activityLogs.create('SIGN_OUT', { email: userProfile.email });
      }
      await azureAuth.signOut();
    } catch {
    } finally {
      setUser(null);
      setUserProfile(null);
      setCustomerCompany(null);
    }
  };

  const hasWriteAccess = userProfile?.user_rights === 'read_write';
  const isManager = userProfile?.role === 'manager';
  const isClient = userProfile?.role === 'client';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        customerCompany,
        loading,
        hasWriteAccess,
        isManager,
        isClient,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
