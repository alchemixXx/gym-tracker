import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  authApi,
  setTokens,
  clearTokens,
  isAuthenticated as checkTokens,
} from '@/api';

interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface UnclaimedUser {
  id: number;
  name: string;
  created_at: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const magicLinkSent = ref(false);

  // Claim flow state
  const needsClaim = ref(false);
  const claimToken = ref<string | null>(null);
  const claimUsers = ref<UnclaimedUser[]>([]);

  const isLoggedIn = computed(() => user.value !== null && checkTokens());

  // Restore user from localStorage on init
  const savedUser = localStorage.getItem('gym-tracker-auth-user');
  if (savedUser && checkTokens()) {
    try {
      user.value = JSON.parse(savedUser);
    } catch {}
  }

  /**
   * Request a magic link email
   */
  async function requestMagicLink(email: string) {
    error.value = null;
    loading.value = true;
    magicLinkSent.value = false;

    try {
      await authApi.requestMagicLink(email);
      magicLinkSent.value = true;
    } catch (err: any) {
      error.value = err.message || 'Failed to send magic link';
    } finally {
      loading.value = false;
    }
  }

  /**
   * Verify a magic link token (called when user clicks the link).
   * Returns 'success' | 'claim' | 'error'
   */
  async function verifyMagicLink(
    token: string,
  ): Promise<'success' | 'claim' | 'error'> {
    error.value = null;
    loading.value = true;
    needsClaim.value = false;

    try {
      const result = await authApi.verifyMagicLink(token);

      if (result.needsClaim) {
        // Server says there are unclaimed profiles — enter claim flow
        needsClaim.value = true;
        claimToken.value = result.claimToken;
        claimUsers.value = result.unclaimedUsers;
        return 'claim';
      }

      // Direct login
      setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      user.value = result.user;
      localStorage.setItem(
        'gym-tracker-auth-user',
        JSON.stringify(result.user),
      );
      return 'success';
    } catch (err: any) {
      error.value = err.message || 'Verification failed';
      return 'error';
    } finally {
      loading.value = false;
    }
  }

  /**
   * Claim an existing account or create a new one.
   * @param userId - ID of unclaimed user to link, or null to create new
   */
  async function claimAccount(userId: number | null): Promise<boolean> {
    error.value = null;
    loading.value = true;

    try {
      const result = await authApi.claimAccount(claimToken.value!, userId);

      setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      user.value = result.user;
      localStorage.setItem(
        'gym-tracker-auth-user',
        JSON.stringify(result.user),
      );

      // Clear claim state
      needsClaim.value = false;
      claimToken.value = null;
      claimUsers.value = [];

      return true;
    } catch (err: any) {
      error.value = err.message || 'Claim failed';
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch current user profile (validates the session is still good)
   */
  async function fetchMe(): Promise<boolean> {
    if (!checkTokens()) return false;

    try {
      const me = await authApi.getMe();
      user.value = me;
      localStorage.setItem('gym-tracker-auth-user', JSON.stringify(me));
      return true;
    } catch {
      // Token invalid — clear session
      logout();
      return false;
    }
  }

  /**
   * Logout — revoke refresh token and clear local state
   */
  async function logout() {
    try {
      if (checkTokens()) {
        await authApi.logout();
      }
    } catch {
      // Ignore errors during logout
    }

    clearTokens();
    user.value = null;
    localStorage.removeItem('gym-tracker-auth-user');
    magicLinkSent.value = false;
    needsClaim.value = false;
    claimToken.value = null;
    claimUsers.value = [];
  }

  function resetError() {
    error.value = null;
    magicLinkSent.value = false;
  }

  return {
    user,
    loading,
    error,
    magicLinkSent,
    isLoggedIn,
    needsClaim,
    claimToken,
    claimUsers,
    requestMagicLink,
    verifyMagicLink,
    claimAccount,
    fetchMe,
    logout,
    resetError,
  };
});
