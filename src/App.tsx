import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { LandingPage } from "./components/LandingPage";
import { SaasLandingPage } from "./components/SaasLandingPage";

export function App() {
  return (
    <>
      <SignedIn>
        <LandingPage />
      </SignedIn>
      <SignedOut>
        <SaasLandingPage />
      </SignedOut>
    </>
  );
}

export default App;
