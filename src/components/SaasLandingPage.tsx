import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  Mic, 
  Headphones, 
  Sparkles, 
  GraduationCap, 
  Waves, 
  ChevronRight, 
  Radio, 
  Zap, 
  Globe, 
  MessageSquare,
  Play
} from "lucide-react";
import { Button } from "./ui/button";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import LightRays from "./LightRays";
import Aurora from "./Aurora";
import { modes } from "./ModeSelector";
import { subjects } from "./SubjectSelector";

function WaveformAnimation() {
  return (
    <div className="flex items-center gap-1 h-12">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-primary rounded-full animate-waveform"
          style={{
            animationDelay: `${i * 0.1}s`,
            height: `${Math.random() * 60 + 20}%`
          }}
        />
      ))}
    </div>
  );
}

function RevealOnScroll({ children, className }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "reveal-on-scroll",
        isVisible && "is-visible",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SaasLandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#00ffff"
          raysSpeed={1}
          lightSpread={0.8}
          rayLength={1.5}
          followMouse={true}
          mouseInfluence={0.05}
          noiseAmount={0.1}
          distortion={0.03}
          className="w-full h-full opacity-40"
        />
      </div>

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md border-b border-border/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
              <img 
                src="/assets/podu-logo.png" 
                alt="PODU Logo" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <span className="font-display text-2xl font-black tracking-tighter">PODU</span>
          </div>
          <div className="flex items-center gap-4">
            <SignInButton mode="modal">
              <button className="text-sm font-mono hover:text-primary transition-colors">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" className="font-mono px-6">Join the Show</Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <RevealOnScroll className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>ON AIR: YOUR INTERACTIVE PODCAST</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-[0.9]">
              THE PODCAST THAT <br />
              <span className="text-primary glow-primary">LISTENS BACK.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-muted-foreground text-lg md:text-xl font-mono leading-relaxed">
              PODU is your AI-powered interactive podcast host. Choose a vibe, pick a topic, and join a conversation that adapts to you in real-time.
            </p>
          </RevealOnScroll>

          <RevealOnScroll className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4" style={{ animationDelay: '0.2s' }}>
            <SignUpButton mode="modal">
              <Button size="lg" className="font-display text-lg px-8 h-14 rounded-2xl group">
                Start Your Episode
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </SignUpButton>
            <WaveformAnimation />
          </RevealOnScroll>
        </div>
      </section>

      {/* Concept Explainer */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto bg-card/30 border border-border/50 rounded-[2rem] p-8 md:p-12 backdrop-blur-sm">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <RevealOnScroll className="space-y-6">
              <h2 className="font-display text-3xl md:text-4xl font-bold">What is PODU?</h2>
              <p className="text-muted-foreground font-mono leading-relaxed">
                Traditional podcasts are a one-way street. You listen, they talk. PODU breaks the fourth wall. 
                Our voice agents are interactive hosts who engage you in deep, meaningful, or hilariously witty discussions.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                    <span className="text-destructive">✕</span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">Passive Listening</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-mono">Active Participation</span>
                </div>
              </div>
            </RevealOnScroll>
            <RevealOnScroll className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 border border-border/50 flex items-center justify-center group">
              <div className="absolute inset-0 bg-grid-white/[0.02]" />
              <Mic className="w-24 h-24 text-primary animate-float" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-primary/20 animate-ripple" />
                <div className="w-48 h-48 rounded-full border border-primary/20 animate-ripple" style={{ animationDelay: '0.5s' }} />
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* Hosting Styles Showcase */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl md:text-5xl font-black">CHOOSE YOUR HOST</h2>
            <p className="text-muted-foreground font-mono">Three distinct personalities for any mood.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {modes.map((mode, i) => {
              const Icon = mode.icon;
              return (
                <RevealOnScroll key={mode.id} style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className={cn(
                    "h-full p-8 rounded-[2rem] border-2 transition-all duration-500 group relative overflow-hidden bg-card/50",
                    "hover:border-primary/50 hover:-translate-y-2",
                    mode.borderColor
                  )}>
                    {/* Mode Color Background Glow */}
                    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br", mode.gradient)} />
                    
                    <div className="relative z-10 space-y-6">
                      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg", mode.activeColor)}>
                        <Icon className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className={cn("font-display text-3xl font-black tracking-tighter", mode.textGradient)}>
                          {mode.name}
                        </h3>
                        <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                          {mode.id === "fun" && "The host who keeps it real. Sarcastic, witty, and always ready with a sharp take on pop culture."}
                          {mode.id === "edu" && "The host who makes you smarter. Clear explanations, insightful breakdowns, and engaging teaching."}
                          {mode.id === "deep" && "The host who goes there. Thoughtful reflection, emotional depth, and philosophical insights."}
                        </p>
                      </div>
                      <div className="pt-4">
                        <div className="px-4 py-3 rounded-xl bg-background/50 border border-border/50 font-mono text-xs italic opacity-80 group-hover:opacity-100 transition-opacity">
                          {mode.id === "fun" && "\"So you want to talk about AI taking over? Let me guess, you've seen Terminator too many times...\""}
                          {mode.id === "edu" && "\"To understand why this matters, we first need to look at how the underlying architecture works...\""}
                          {mode.id === "deep" && "\"It's fascinating how our memories aren't just records of the past, but stories we tell ourselves...\""}
                        </div>
                      </div>
                    </div>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="font-display text-4xl font-bold">HOW TO START YOUR SHOW</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2 z-0" />
            
            {[
              { icon: Globe, title: "Pick Your Topic", desc: "From tech trends to ancient history. Or upload your own doc." },
              { icon: Sparkles, title: "Choose Your Host", desc: "Match the personality to your vibe." },
              { icon: Play, title: "Join the Show", desc: "Speak, listen, and explore together." }
            ].map((step, i) => (
              <RevealOnScroll key={i} className="relative z-10 bg-background flex flex-col items-center text-center space-y-6" style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="w-20 h-20 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-display text-xl font-bold">{step.title}</h4>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Topic Universe */}
      <section className="py-24 px-6 overflow-hidden bg-card/20 border-y border-border/50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row items-end justify-between gap-6">
            <div className="space-y-4">
              <h2 className="font-display text-4xl font-black tracking-tighter">ANY SUBJECT. ANY DEPTH.</h2>
              <p className="text-muted-foreground font-mono">Our hosts are up to date and insightful about any subject matter.</p>
            </div>
            <SignUpButton mode="modal">
              <Button variant="outline" className="font-mono">Explore All Topics</Button>
            </SignUpButton>
          </div>

          <div className="flex flex-wrap gap-3">
            {subjects.map((sub, i) => (
              <RevealOnScroll key={sub.id} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm",
                  "hover:border-primary/50 hover:bg-primary/5 transition-all cursor-default group"
                )}>
                  <div className={cn("p-1 rounded-md text-white scale-75 group-hover:scale-100 transition-transform bg-gradient-to-br", sub.color)}>
                    {sub.icon}
                  </div>
                  <span className="text-sm font-display font-medium">{sub.name}</span>
                </div>
              </RevealOnScroll>
            ))}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5">
              <span className="text-sm font-display font-medium text-primary">...and thousands more</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why PODU */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-12">
              <RevealOnScroll className="space-y-4">
                <h2 className="font-display text-4xl font-black leading-tight">THE HOST THAT NEVER <br />STOP LEARNING.</h2>
                <p className="text-muted-foreground font-mono leading-relaxed">
                  PODU's unique value lies in its depth. It's not just another AI chatbot - it's a personality built to challenge, entertain, and inspire you.
                </p>
              </RevealOnScroll>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {[
                  { icon: Zap, title: "Always Current", desc: "Insightful about breaking news and trends." },
                  { icon: MessageSquare, title: "Interactive Flow", desc: "Responds naturally to your insights." },
                  { icon: Globe, title: "Any Level", desc: "Casual chats or PhD-level deep dives." },
                  { icon: Headphones, title: "High Fidelity", desc: "Natural, expressive voice agents." }
                ].map((feature, i) => (
                  <RevealOnScroll key={i} className="space-y-3" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h5 className="font-display font-bold">{feature.title}</h5>
                    <p className="text-xs font-mono text-muted-foreground">{feature.desc}</p>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
            
            <RevealOnScroll className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse-glow" />
              <div className="relative aspect-square rounded-[3rem] overflow-hidden border border-border/50 bg-background/50 backdrop-blur-xl p-1">
                <div className="w-full h-full rotate-180">
                  <Aurora
                    colorStops={["#00ffff", "#aa00ff", "#ff8800"]}
                    blend={0.5}
                    amplitude={1.2}
                    speed={0.5}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute bottom-0 left-0 right-0 h-full overflow-hidden pointer-events-none rotate-180 opacity-50">
            <Aurora
              colorStops={["#00ffff", "#aa00ff", "#ff8800"]}
              blend={0.5}
              amplitude={1.0}
              speed={0.3}
              className="w-full h-full"
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-12 relative z-10">
          <RevealOnScroll className="space-y-6">
            <h2 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-none">
              READY TO JOIN <br />THE CONVERSATION?
            </h2>
            <p className="text-xl font-mono text-muted-foreground max-w-xl mx-auto">
              Your personal podcast host is waiting. Sign up now and start your first episode.
            </p>
          </RevealOnScroll>

          <RevealOnScroll className="flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: '0.2s' }}>
            <SignUpButton mode="modal">
              <Button size="lg" className="h-16 px-12 text-xl font-display rounded-2xl shadow-2xl shadow-primary/30">
                Create Free Account
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button size="lg" variant="outline" className="h-16 px-12 text-xl font-display rounded-2xl">
                Sign In
              </Button>
            </SignInButton>
          </RevealOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 grayscale opacity-50">
            <img src="/assets/podu-logo.png" alt="PODU" className="w-6 h-6" />
            <span className="font-display font-bold">PODU</span>
          </div>
          <div className="flex gap-8 text-xs font-mono text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground opacity-50">
            © 2025 PODU. THE FUTURE OF INTERACTIVE MEDIA.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Check(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

