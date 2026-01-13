// src/routes/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../pages/Authentication/index';
import Home from '../pages/Home';
import { RequireAuth } from '../app/RequireAuth';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
    children: [
      // These are handled within Home component via activeRoute state
      // But we can add them here for direct URL access
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
    ],
  },
  {
    path: '/chat',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/chat/:conversationId',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/groups',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/groups/:groupId',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/expenses',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/expenses/:expenseId',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/chat" replace />,
  },
]);