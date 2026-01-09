// src/redux/actions/authActions.ts

import { AppDispatch } from '../store';
import { authService, LoginCredentials, RegisterData } from '../../services/auth.service';
import { authStart, authSuccess, authFailure, logout as logoutAction } from '../slices/authSlice';
import { connectWebSocket, disconnectWebSocket } from './websocketActions';

/**
 * Login user
 */
export const login = (credentials: LoginCredentials) => async (dispatch: AppDispatch) => {
  try {
    dispatch(authStart());

    const response = await authService.login(credentials);

    if (response.success && response.data) {
      const { user, access_token, refresh_token } = response.data;

      // Update Redux state
      dispatch(authSuccess({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          name: user.name,
          bio: user.bio,
          createdAt: user.created_at,
        },
        token: access_token,
        refreshToken: refresh_token,
      }));

      // Connect WebSocket
      dispatch(connectWebSocket(access_token));

      return { success: true };
    } else {
      dispatch(authFailure(response.message || 'Login failed'));
      return { success: false, error: response.message };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Login failed';
    dispatch(authFailure(errorMessage));
    return { success: false, error: errorMessage };
  }
};

/**
 * Register new user
 */
export const register = (data: RegisterData) => async (dispatch: AppDispatch) => {
  try {
    dispatch(authStart());

    const response = await authService.register(data);

    if (response.success && response.data) {
      const { user, access_token, refresh_token } = response.data;

      // Update Redux state
      dispatch(authSuccess({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          name: user.name,
          bio: user.bio,
          createdAt: user.created_at,
        },
        token: access_token,
        refreshToken: refresh_token,
      }));

      // Connect WebSocket
      dispatch(connectWebSocket(access_token));

      return { success: true };
    } else {
      dispatch(authFailure(response.message || 'Registration failed'));
      return { success: false, error: response.message };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
    dispatch(authFailure(errorMessage));
    return { success: false, error: errorMessage };
  }
};

/**
 * Logout user
 */
export const logout = () => (dispatch: AppDispatch) => {
  // Disconnect WebSocket
  dispatch(disconnectWebSocket());
  
  // Clear auth state
  dispatch(logoutAction());
};

/**
 * Load user from token (on app startup)
 */
export const loadUser = () => async (dispatch: AppDispatch, getState: any) => {
  try {
    const token = getState().auth.token;

    if (!token) {
      return;
    }

    dispatch(authStart());

    const response = await authService.getCurrentUser(token);

    if (response.success && response.data) {
      const user = response.data;

      dispatch(authSuccess({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          name: user.name,
          bio: user.bio,
          createdAt: user.created_at,
        },
        token,
      }));

      // Connect WebSocket
      dispatch(connectWebSocket(token));
    } else {
      dispatch(logout());
    }
  } catch (error) {
    console.error('Failed to load user:', error);
    dispatch(logout());
  }
};