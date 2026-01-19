import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Animated chain link component for the background
const ChainLink = ({
  delay,
  left,
  top,
}: {
  delay: number;
  left: string;
  top: string;
}) => (
  <div
    className="absolute w-4 h-8 border-2 border-primary/20 rounded-full animate-float"
    style={{
      left,
      top,
      animationDelay: `${delay}s`,
    }}
  />
);

// Animated particle for background effects
const Particle = ({
  delay,
  size,
  duration,
  left,
}: {
  delay: number;
  size: number;
  duration: number;
  left: string;
}) => (
  <div
    className="absolute rounded-full bg-gradient-to-br from-primary/30 to-transparent animate-rise"
    style={{
      width: size,
      height: size,
      left,
      bottom: "-10%",
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

// Feature card component
const FeatureCard = ({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) => (
  <div
    className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-500 hover:scale-105 hover:shadow-xl hover:shadow-primary/10 animate-fade-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative z-10">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

// Stats component
const StatItem = ({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) => (
  <div
    className="text-center animate-fade-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
      {value}
    </div>
    <div className="text-muted-foreground text-sm mt-1">{label}</div>
  </div>
);

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  // Generate stable positions for chain links (only once on mount)
  const chainLinks = useMemo(
    () =>
      [...Array(30)].map((_, i) => ({
        id: i,
        delay: i * 0.3,
        left: `${(i * 3.3) % 100}%`,
        top: `${(i * 13 + 3) % 100}%`,
      })),
    [],
  );

  // Generate stable positions for rising particles (only once on mount)
  const particles = useMemo(
    () =>
      [...Array(25)].map((_, i) => ({
        id: i,
        delay: i * 0.5,
        size: 8 + (i % 4) * 6,
        duration: 12 + (i % 6) * 3,
        left: `${(i * 4) % 100}%`,
      })),
    [],
  );

  // Generate stable positions for floating circles (only once on mount)
  const floatingCircles = useMemo(
    () =>
      [...Array(20)].map((_, i) => ({
        id: i,
        delay: i * 0.4,
        size: 6 + (i % 5) * 4,
        left: `${(i * 5) % 100}%`,
        top: `${(i * 19 + 10) % 100}%`,
      })),
    [],
  );

  // Generate stable positions for oval particles (only once on mount)
  const ovalParticles = useMemo(
    () =>
      [...Array(18)].map((_, i) => ({
        id: i,
        delay: i * 0.6,
        width: 12 + (i % 4) * 8,
        height: 6 + (i % 3) * 4,
        left: `${(i * 5.5) % 100}%`,
        top: `${(i * 23 + 8) % 100}%`,
        rotation: (i * 30) % 180,
      })),
    [],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Animated gradient background */}
      <div
        className="fixed inset-0 opacity-30 transition-all duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, oklch(0.488 0.243 264.376 / 0.3), transparent 50%),
                       radial-gradient(circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, oklch(0.696 0.17 162.48 / 0.2), transparent 50%)`,
        }}
      />

      {/* Floating chain links */}
      {chainLinks.map((link) => (
        <ChainLink
          key={link.id}
          delay={link.delay}
          left={link.left}
          top={link.top}
        />
      ))}

      {/* Rising particles */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          delay={particle.delay}
          size={particle.size}
          duration={particle.duration}
          left={particle.left}
        />
      ))}

      {/* Floating circles */}
      {floatingCircles.map((circle) => (
        <div
          key={`circle-${circle.id}`}
          className="absolute rounded-full bg-primary/10 animate-float-slow"
          style={{
            width: circle.size,
            height: circle.size,
            left: circle.left,
            top: circle.top,
            animationDelay: `${circle.delay}s`,
          }}
        />
      ))}

      {/* Oval particles */}
      {ovalParticles.map((oval) => (
        <div
          key={`oval-${oval.id}`}
          className="absolute rounded-full bg-primary/15 animate-float-reverse"
          style={{
            width: oval.width,
            height: oval.height,
            left: oval.left,
            top: oval.top,
            transform: `rotate(${oval.rotation}deg)`,
            animationDelay: `${oval.delay}s`,
          }}
        />
      ))}
      {/* Navigation */}
      <nav className="relative z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-sm font-bold shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-shadow duration-300">
              SC
            </div>
            <span className="text-xl font-bold tracking-tight">
              SupplyChain
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="hover:bg-primary/10">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow duration-300">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium mb-8 animate-fade-down">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Protecting 10,000+ Projects Worldwide
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-up">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Secure Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent animate-gradient">
              Supply Chain
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            Detect malicious packages, typosquatting, and dependency confusion
            attacks before they compromise your software. AI-powered security
            for modern development.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Link to="/signup">
              <Button
                size="lg"
                className="text-lg px-8 py-6 shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300 group"
              >
                Start Scanning Free
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 hover:bg-primary/5 hover:scale-105 transition-all duration-300"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Watch Demo
            </Button>
          </div>

          {/* Animated visual */}
          <div
            className="mt-20 relative animate-fade-up"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-8 shadow-2xl">
              {/* Terminal-like UI */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-4 text-sm text-muted-foreground font-mono">
                  supply-chain-scanner
                </span>
              </div>
              <div className="space-y-3 font-mono text-sm text-left">
                <div className="flex items-center gap-2 animate-typing">
                  <span className="text-green-400">$</span>
                  <span className="text-muted-foreground">
                    sc-scan package.json
                  </span>
                </div>
                <div className="text-primary/80 animate-pulse">
                  Analyzing 247 dependencies...
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">⚠</span>
                  <span className="text-muted-foreground">
                    Found typosquatting attempt:{" "}
                    <span className="text-red-400">1odash</span> →{" "}
                    <span className="text-green-400">lodash</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400">✗</span>
                  <span className="text-muted-foreground">
                    Critical:{" "}
                    <span className="text-red-400">malicious-pkg@1.0.0</span>{" "}
                    contains obfuscated code
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-muted-foreground">
                    245 packages verified as safe
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 border-y border-border/50 bg-card/30 backdrop-blur-sm py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem value="10M+" label="Packages Scanned" delay={0} />
            <StatItem value="50K+" label="Threats Detected" delay={0.1} />
            <StatItem value="99.9%" label="Accuracy Rate" delay={0.2} />
            <StatItem value="<1s" label="Avg. Scan Time" delay={0.3} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 container mx-auto px-4 py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 animate-fade-up">
            Comprehensive Protection
          </h2>
          <p
            className="text-muted-foreground text-lg max-w-2xl mx-auto animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            Advanced threat detection powered by machine learning and real-time
            analysis.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            delay={0.2}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
            title="Typosquatting Detection"
            description="Identify packages that impersonate popular libraries with similar names to steal your data."
          />
          <FeatureCard
            delay={0.3}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            title="Dependency Confusion"
            description="Prevent attackers from injecting malicious code through internal package naming conflicts."
          />
          <FeatureCard
            delay={0.4}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
            title="Real-time Alerts"
            description="Get instant notifications when new vulnerabilities are discovered in your dependencies."
          />
          <FeatureCard
            delay={0.5}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            }
            title="CI/CD Integration"
            description="Seamlessly integrate with GitHub Actions, GitLab CI, Jenkins, and more."
          />
          <FeatureCard
            delay={0.6}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            title="Risk Scoring"
            description="Comprehensive risk assessment with actionable insights for each vulnerability."
          />
          <FeatureCard
            delay={0.7}
            icon={
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            }
            title="Custom Policies"
            description="Define your own security rules and compliance requirements for your organization."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-4 py-32">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-3xl" />
          <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-3xl p-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Ready to Secure Your
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {" "}
                Supply Chain?
              </span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of developers who trust us to protect their
              software from malicious dependencies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300"
                >
                  Get Started Free
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 hover:bg-primary/5"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30 backdrop-blur-sm py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-xs font-bold">
                SC
              </div>
              <span className="font-semibold">Supply Chain Detection</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Documentation
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                API
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Supply Chain Detection. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-30px) scale(1.2); opacity: 0.7; }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.5; }
          25% { transform: translateY(-15px) translateX(10px); opacity: 0.7; }
          50% { transform: translateY(-25px) translateX(-5px); opacity: 0.6; }
          75% { transform: translateY(-10px) translateX(-10px); opacity: 0.8; }
        }
        @keyframes rise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-down {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradient {
          0%, 100% { background-size: 200% 200%; background-position: left center; }
          50% { background-size: 200% 200%; background-position: right center; }
        }
        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-reverse { animation: float-reverse 10s ease-in-out infinite; }
        .animate-rise { animation: rise 15s linear infinite; }
        .animate-fade-up { animation: fade-up 0.8s ease-out forwards; opacity: 0; }
        .animate-fade-down { animation: fade-down 0.8s ease-out forwards; opacity: 0; }
        .animate-gradient { animation: gradient 3s ease infinite; }
        .animate-typing { overflow: hidden; white-space: nowrap; border-right: 2px solid; animation: typing 2s steps(30, end); }
      `}</style>
    </div>
  );
}
