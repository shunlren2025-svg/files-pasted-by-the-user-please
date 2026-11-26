# FlowChart notes

## Run it
- SDK: 58 (the project dependency set and the available Expo Go target are SDK 58; change only if Expo Go on the phone changes.)
- Install: `pnpm install`
- Start the AI helper: `pnpm helper`
- Start Expo: `pnpm start`
- Start the web version: `npx expo start --web` (or `pnpm web`)
- The helper uses `getKey()` on the computer. The phone app never contains the key.
- The app connects to the helper at the computer's local Wi-Fi address. If using Expo Tunnel, set `EXPO_PUBLIC_HELPER_URL` to a reachable HTTPS/tunnel URL.

## Done
- Saved the project brief in BRIEF.md.
- Built the schedule-first FlowChart MVP with local phone storage.
- Added an AI Homework Helper screen with Thinking state, safe assumptions, choices, and the required disclaimer.
- Added a small Node helper that sends the brief's AI instructions with every request.
- Added Messages as a clear placeholder for the next integration.

## Maybe Later
- Day Streak to keep people engaged.

## Web and Vercel
- Web uses the same SDK 58 and the Expo web packages: `react-dom`, `react-native-web`, and `@expo/metro-runtime`.
- On web, FlowChart stays inside a centered phone-sized frame about 400px wide. Expo Go keeps its original full-screen phone layout.
- Web AI requests go to `api/ai.mjs`. Expo Go continues to use the local computer helper.
- Vercel builds with `npx expo export -p web`, serves `dist`, and rewrites all routes to `/` using `vercel.json`.
- In Vercel Project Settings → Environment Variables, add `KEYGEN_URL` and `KEYGEN_TOKEN` for the Production environment (and Preview if needed). No other Vercel setting is required.
- The Vercel function reads those variables only on the server, calls `getKey()`, and sends the resulting key to OpenAI. Neither secret is in the app or repository.
- Deploy with `vercel` or connect the GitHub repository in Vercel. The saved export was verified locally with `npx expo export -p web`.

## Next
- Connect Messages to TeamSnap (or a similar service) after the core demo is tested.
- Test the helper with messy, incomplete notes and review AI answers before filming.

## Live run
- Expo is started in the background with live reload.
- Current Expo link: `exp://10.0.0.205:8081`
- Current helper address: `http://10.0.0.205:8787`
- Scan the saved QR page in `flowchart-app/flowchart-qr.html`.
- The helper health check passed. Metro is listening, but this restricted session returned a Metro `transformFile` error for the first bundle request; run `npx expo install --fix` and restart Expo from a normal Node/npm terminal if the phone shows a bundle error.

## Requested checks
- `npx create-expo-app@latest` could not run because this computer session does not expose npm/npx and the bundled one-off package runner is blocked by a Windows profile restriction.
- The project was created in place with the Expo blank-project files and the compatible SDK 58 dependency set.
- Run `npx expo install --fix` and `npx expo-doctor` from a normal Node/npm terminal on the computer before the first phone run if those commands are available there.
