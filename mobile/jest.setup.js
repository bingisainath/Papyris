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
