// Native modules aren't available in Jest; give them small in-memory stand-ins.
jest.mock('react-native-keychain', () => {
  let saved = null;
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'x' },
    getGenericPassword: jest.fn(async () => saved),
    setGenericPassword: jest.fn(async (username, password) => { saved = { username, password }; return true; }),
    resetGenericPassword: jest.fn(async () => { saved = null; return true; }),
  };
});

// Native-only libraries the stores import (never called in these tests)
jest.mock('react-native-create-thumbnail', () => ({ createThumbnail: jest.fn() }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { dirs: {} }, config: jest.fn() } }));

// The app's dialog (icons and a Modal); tests only need to know it was asked to show something
jest.mock('./src/components/Dialog', () => ({ showAlert: jest.fn(), DialogHost: () => null }));
