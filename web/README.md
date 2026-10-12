# Papyris web (React)

The browser app for Papyris. Setup, tests and the folder layout are in the main
[README](../README.md).

```bash
npm install
npm start            # http://localhost:3000, talks to the API on :8000
CI=true npm test     # unit tests
npx tsc --noEmit     # type check
npm run check:e2e    # shared encryption files match the mobile app
```
