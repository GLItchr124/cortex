import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Brain, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get source from URL params
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const source = params.get("ref") || params.get("source") || undefined;
  const campaign = params.get("utm_campaign") || params.get("campaign") || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signup(email, password, name || undefined, source, campaign);
      setLocation("/dashboard");
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "";
      const desc = msg.includes("400") || msg.toLowerCase().includes("already")
        ? "Email already registered. Try logging in."
        : msg.includes("Invalid input")
          ? "Please check your email and password (6+ characters)."
          : "Something went wrong. Please try again.";
      toast({ title: "Signup failed", description: desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-4 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Cortex</span>
            </div>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground">Start studying smarter in under a minute</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm">Name (optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              data-testid="input-name"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5"
              data-testid="input-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline" data-testid="link-to-login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: "Invalid email or password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-4 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Cortex</span>
            </div>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Log in to continue studying</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5"
              data-testid="input-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Log in <ArrowRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline" data-testid="link-to-signup">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
