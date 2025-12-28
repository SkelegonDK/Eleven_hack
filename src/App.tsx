import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { LandingPage } from "./components/LandingPage";
import { SaasLandingPage } from "./components/SaasLandingPage";
import { Button } from "./components/ui/button";
import { Headphones } from "lucide-react";
import LightRays from "./components/LightRays";
import type { ConversationMode } from "./components/ModeSelector";

const getModeColor = (mode: ConversationMode): string => {
  switch (mode) {
    case "fun":
      return "#ff8800"; // orange/amber
    case "edu":
      return "#00ffff"; // cyan
    case "deep":
      return "#aa00ff"; // violet/purple
    default:
      return "#00ffff"; // default to cyan
  }
};

function WelcomePage() {
  return (
    <SaasLandingPage />
  );
}

export function App() {
  return (
    <>
      <SignedIn>
        <LandingPage />
      </SignedIn>
      <SignedOut>
        <WelcomePage />
      </SignedOut>
    </>
  );
}

export default App;
