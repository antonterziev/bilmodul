import * as Sentry from "@sentry/react";

// Initialize Sentry
export const initSentry = () => {
  Sentry.init({
    dsn: "https://22e3cba5ad5d22fd55efb373b0720cb7@o4509858653470720.ingest.de.sentry.io/4509858665791568",
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
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