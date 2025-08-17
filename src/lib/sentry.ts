import * as Sentry from "@sentry/react";

// Initialize Sentry
export const initSentry = () => {
  Sentry.init({
    dsn: "https://yztwwehxppldoecwhomg.supabase.co/functions/v1/get-secret?name=SENTRY_DSN_FRONTEND",
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
};

// Error boundary wrapper
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Capture exception
export const captureException = Sentry.captureException;

// Capture message
export const captureMessage = Sentry.captureMessage;

// Add user context
export const setUser = Sentry.setUser;

// Add custom context
export const setContext = Sentry.setContext;