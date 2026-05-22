import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  TrendingUp,
  Download,
  Shield,
  Zap,
  Aperture,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description:
      "Track engagement rates, follower growth, post performance, and content trends with beautiful charts.",
  },
  {
    icon: Users,
    title: "Multi-Account Tracking",
    description:
      "Monitor your own accounts and tag accounts as competitor, influencer, brand, or other.",
  },
  {
    icon: TrendingUp,
    title: "Competitor Insights",
    description:
      "Compare your performance against competitors using publicly available Instagram data.",
  },
  {
    icon: Download,
    title: "CSV Export & Import",
    description:
      "Bulk import accounts via CSV and export any report or media data for offline analysis.",
  },
  {
    icon: Shield,
    title: "API-First & Secure",
    description:
      "Built exclusively on official Meta Instagram APIs. Your data is encrypted and never shared.",
  },
  {
    icon: Zap,
    title: "Automated Syncing",
    description:
      "Schedule daily or weekly syncs to keep your data fresh without manual effort.",
  },
];

const useCases = [
  "Marketing agencies managing multiple brand accounts",
  "E-commerce brands tracking competitor content strategies",
  "Influencer managers analyzing growth and engagement",
  "Social media teams producing weekly performance reports",
  "Startups benchmarking against industry leaders",
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for getting started",
    features: [
      "3 tracked accounts",
      "30 days of history",
      "Managed Instagram connection",
      "Basic analytics",
      "CSV export",
    ],
    note: null,
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    description: "For growing teams",
    features: [
      "25 tracked accounts",
      "90 days of history",
      "Managed Instagram connection",
      "Advanced analytics & competitor comparison",
      "Fair-use sync limits",
      "Priority support",
    ],
    note: null,
    highlight: true,
  },
  {
    name: "Agency",
    price: "$99",
    description: "For agencies and enterprise teams",
    features: [
      "Unlimited accounts",
      "1 year of history",
      "Managed OAuth or BYO Meta App",
      "Assisted Meta App setup available",
      "White-label reports",
      "Higher sync limits",
      "Dedicated support",
    ],
    note: "BYO Meta App for dedicated quota isolation",
    highlight: false,
  },
];

const faqItems = [
  {
    q: "Is this like YouTube API key setup?",
    a: "No. Instagram requires Meta OAuth, a Business/Creator account, and a Facebook Page linkage. There is no simple server-side API key. For most users, clicking Connect Instagram handles everything automatically.",
  },
  {
    q: "Is Meta API quota unlimited?",
    a: "No. Meta applies dynamic rate limits per app and per user. InstaPulse logs API usage headers (X-App-Usage) after each call and automatically pauses sync when usage is high. Agencies can use their own Meta App to isolate quota.",
  },
  {
    q: "Should every user bring their own Meta App?",
    a: "No. Most users should use Connect Instagram — it requires no Meta Developer account. BYO Meta App is mainly for agencies and enterprise customers who need dedicated quota isolation or own the Meta Business relationship.",
  },
  {
    q: "Does BYO Meta App unlock competitor reach or impressions?",
    a: "No. Competitor private metrics — reach, impressions, saves, shares, story insights, and audience demographics — are not available through the official Instagram API regardless of which Meta App credentials are used.",
  },
  {
    q: "Can InstaPulse help set up a BYO Meta App?",
    a: "Yes. Agency and enterprise onboarding can include assisted Meta API setup. We help configure your Meta Developer App, OAuth redirect URI, and permissions. Meta App Review approval timelines are controlled by Meta and cannot be guaranteed.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">InstaPulse</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 text-center bg-gradient-to-b from-violet-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 text-violet-700 text-sm px-4 py-1.5 mb-6 font-medium">
            <Aperture className="h-4 w-4" />
            Official Instagram API Only — No Scraping
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Instagram Analytics{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-500">
              Supercharged
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Track your Instagram business accounts, benchmark against competitors, and uncover
            actionable insights — all through the official Meta API.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="px-8">
                Start for free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="px-8">
                View demo dashboard
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required · Demo data included · Connect Instagram in 2 minutes
          </p>
        </div>
      </section>

      {/* API Disclaimer */}
      <section className="py-8 px-4 bg-amber-50 border-y border-amber-200">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Instagram API Reality:</strong> InstaPulse uses official Meta Instagram APIs
            only. Detailed insights (reach, impressions, saves) are only available for your own
            connected Business/Creator accounts. Competitor data is limited to publicly available
            metrics. We clearly indicate when metrics are unavailable via the API.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need to grow
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              A complete analytics suite built for Instagram professionals, agencies, and brands.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Built for Instagram professionals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {useCases.map((useCase) => (
              <div
                key={useCase}
                className="flex items-start gap-3 bg-white rounded-lg px-4 py-3 border border-gray-100"
              >
                <CheckCircle2 className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">{useCase}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-600">Start free, upgrade when you need more.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border-2 p-6 ${
                  plan.highlight
                    ? "border-violet-500 shadow-lg shadow-violet-100"
                    : "border-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 text-xs px-3 py-1 mb-3 font-medium">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-3">{plan.description}</p>
                <p className="text-3xl font-bold text-gray-900 mb-6">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <ul className="space-y-2.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-violet-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.note && (
                  <p className="text-xs text-gray-500 italic mb-4">{plan.note}</p>
                )}
                <Link href="/auth/signup">
                  <Button className="w-full" variant={plan.highlight ? "default" : "outline"}>
                    Get started
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise callout */}
          <div className="mt-8 rounded-xl border-2 border-gray-200 p-6 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Enterprise</h3>
                <p className="text-gray-600 text-sm mt-1">Dedicated BYO Meta App setup, assisted onboarding, usage isolation, custom sync limits, and App Review preparation support. Contact us for pricing.</p>
              </div>
              <Link href="mailto:hello@instapulse.app" className="shrink-0">
                <Button variant="outline">Contact sales</Button>
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            All plans use official Meta Instagram APIs. Available metrics depend on the permissions your Instagram account grants via OAuth.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Meta API — common questions</h2>
            <p className="text-gray-600 text-sm">Instagram API access works differently from most analytics tools. Here&apos;s what to expect.</p>
          </div>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <div key={item.q} className="bg-white rounded-xl border border-gray-100 px-6 py-5">
                <p className="font-semibold text-gray-900 mb-2">{item.q}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-violet-600 to-pink-500 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to grow with data?</h2>
          <p className="text-violet-100 mb-8">
            Connect your Instagram account and start seeing insights in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" variant="secondary" className="px-8 text-violet-700">
                Get started free
              </Button>
            </Link>
            <Link href="/dashboard/connect">
              <Button
                size="lg"
                variant="outline"
                className="px-8 border-white text-white hover:bg-white/10"
              >
                <Aperture className="mr-2 h-4 w-4" />
                Connect Instagram
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">InstaPulse Analytics</span>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Uses official Instagram APIs. Available metrics depend on Meta API permissions. Not
            affiliated with Meta or Instagram.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 underline">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600 underline">Terms</Link>
            <Link href="/data-deletion" className="hover:text-gray-600 underline">Data Deletion</Link>
            <span>© 2025 InstaPulse</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
