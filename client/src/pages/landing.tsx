import { Link } from "wouter";
import { Brain, Zap, Target, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

const features = [
  {
    icon: Brain,
    title: "Active Recall",
    description: "Every card forces you to retrieve the answer from memory. No passive rereading — your brain does the work.",
  },
  {
    icon: Zap,
    title: "Spaced Repetition",
    description: "Cards reappear at scientifically timed intervals. You review right before you forget, locking knowledge in long-term memory.",
  },
  {
    icon: Target,
    title: "Focused by Design",
    description: "No bloat, no feature creep. Add questions, study, and track progress. That's it. Fast and frictionless.",
  },
  {
    icon: BarChart3,
    title: "Progress You Can See",
    description: "Track your streak, cards completed, and mastery over time. Minimal stats that actually motivate.",
  },
];

const howItWorks = [
  { step: "1", title: "Create cards", description: "Type a question on the front and the answer on the back. Organize by deck." },
  { step: "2", title: "Study daily", description: "Your review queue shows cards due today. Answer from memory, then rate your confidence." },
  { step: "3", title: "Remember forever", description: "The algorithm schedules reviews at optimal intervals. Hard cards appear more often; easy cards fade back." },
];

const faqs = [
  {
    q: "How is this different from regular flashcards?",
    a: "Most flashcard apps let you flip through cards randomly. Cortex uses the SM-2 spaced repetition algorithm to schedule each card at the precise moment you're about to forget it. This means you study less overall but remember more long-term.",
  },
  {
    q: "Is it really free?",
    a: "Yes. The core features — creating cards, studying with spaced repetition, and tracking progress — are completely free with a generous card limit. A paid tier will eventually unlock advanced stats and higher limits at a student-friendly price.",
  },
  {
    q: "What subjects does this work for?",
    a: "Anything where you need to memorize facts: biology, history, language vocabulary, medical terms, law concepts, programming syntax, and more. If it can be a question and answer, it works here.",
  },
  {
    q: "Does this actually work better than rereading my notes?",
    a: "Research consistently shows that active recall (testing yourself) produces 50–150% better retention than passive review. Combine that with spaced repetition, and you can remember material for months or years with minimal study time.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 md:px-8 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Cortex</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" data-testid="link-login">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" data-testid="link-signup">
              Get started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-5 md:px-8 pt-16 pb-20 md:pt-24 md:pb-28 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-accent/50 px-3.5 py-1.5 text-xs font-medium text-accent-foreground mb-6">
          <Zap className="w-3.5 h-3.5" />
          Built on active recall &amp; spaced repetition
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-5">
          Study less,{" "}
          <span className="text-primary">remember more</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          A simple study app that makes your brain do the work. Add questions, study with smart scheduling, and retain what you learn — backed by cognitive science.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="text-sm px-6" data-testid="button-hero-signup">
              Start studying free
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-learn-more"
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See how it works
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="px-5 md:px-8 py-16 md:py-20 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-3">Why Cortex works</h2>
          <p className="text-sm text-muted-foreground text-center mb-12 max-w-lg mx-auto">
            Two techniques, decades of research, one focused tool.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border/50 bg-card/50">
                <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-5 md:px-8 py-16 md:py-20 border-t border-border/40 bg-accent/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-12">Three steps to better retention</h2>
          <div className="space-y-8">
            {howItWorks.map((s) => (
              <div key={s.step} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof / stats */}
      <section className="px-5 md:px-8 py-16 md:py-20 border-t border-border/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-semibold mb-4">The science is clear</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            <div className="p-5 rounded-xl border border-border/50 bg-card/50">
              <div className="text-2xl font-bold text-primary mb-1">150%</div>
              <p className="text-xs text-muted-foreground">better retention from active recall vs rereading</p>
            </div>
            <div className="p-5 rounded-xl border border-border/50 bg-card/50">
              <div className="text-2xl font-bold text-primary mb-1">50%</div>
              <p className="text-xs text-muted-foreground">less study time with spaced repetition</p>
            </div>
            <div className="p-5 rounded-xl border border-border/50 bg-card/50">
              <div className="text-2xl font-bold text-primary mb-1">90%+</div>
              <p className="text-xs text-muted-foreground">long-term retention when used consistently</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 md:px-8 py-16 md:py-20 border-t border-border/40 bg-accent/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-10">Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-medium text-sm mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-border/40">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-semibold mb-3">Ready to remember what you study?</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Free to use. No credit card. Start in under a minute.
          </p>
          <Link href="/signup">
            <Button size="lg" className="text-sm px-6" data-testid="button-bottom-cta">
              Create your free account
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 md:px-8 py-8 border-t border-border/40">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="w-4 h-4" />
            <span>Cortex — Study less, remember more.</span>
          </div>
          <PerplexityAttribution />
        </div>
      </footer>
    </div>
  );
}
