// src/routes/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from '../pages/Authentication';
import Home from '../pages/Home';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import VerifyEmail from '../pages/VerifyEmail';
import InfoPage from '../pages/Info';
import AdminPage from '../pages/Admin';
import Landing from '../pages/Landing';
import { INFO_PAGES } from '../content/infoPages';
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
    path: '/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/reset-password',
    element: <ResetPassword />,
  },
  {
    path: '/verify-email',
    element: <VerifyEmail />,
  },
  // About, FAQ, Contact, Terms, Privacy: public
  ...INFO_PAGES.map((page) => ({ path: `/${page.slug}`, element: <InfoPage /> })),
  // The public homepage; signed-in people go straight to /chat
  {
    path: '/',
    element: <Landing />,
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
  // The admin console (app admins only; the server checks every call)
  ...['/admin', '/admin/:tab'].map((path) => ({
    path,
    element: (
      <RequireAuth>
        <AdminPage />
      </RequireAuth>
    ),
  })),
  {
    path: '*',
    element: <Navigate to="/chat" replace />,
  },
]);