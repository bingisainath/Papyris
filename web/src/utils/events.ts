// src/utils/events.ts
// Window events that let non-component code talk to the app.

/** detail: path. Home navigates there (used by toasts and notifications). */
export const NAVIGATE_EVENT = 'papyris:navigate';

/** detail: conversation id. Fired when a conversation's details change (info panel refreshes). */
export const CONVERSATION_UPDATED_EVENT = 'papyris:conversation-updated';
