import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { LandingPage } from "./components/LandingPage";
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* LightRays background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor={getModeColor("edu")}
          raysSpeed={1.5}
          lightSpread={0.8}
          rayLength={1.2}
          followMouse={true}
          mouseInfluence={0.1}
          noiseAmount={0.2}
          distortion={0.05}
          className="w-full h-full"
        />
      </div>

      {/* Main content - centered */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-8 max-w-md text-center">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent blur-lg opacity-50" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary to-accent">
                <Headphones className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="font-display text-5xl font-extrabold tracking-tight">
                PODU
              </h1>
              <p className="font-mono text-sm text-muted-foreground mt-2">
                Interactive Podcast
              </p>
            </div>
          </div>

          {/* Welcome message */}
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-semibold">
              Welcome to PODU
            </h2>
            <p className="font-mono text-sm text-muted-foreground">
              Sign in to start your interactive podcast experience
            </p>
          </div>

          {/* Auth buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <SignInButton mode="modal">
              <Button variant="outline" size="lg" className="font-mono w-full sm:w-auto">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="lg" className="font-mono w-full sm:w-auto">
                Sign Up
              </Button>
            </SignUpButton>
          </div>
        </div>
      </main>
    </div>
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
