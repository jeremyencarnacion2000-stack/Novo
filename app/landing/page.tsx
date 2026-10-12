"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDot,
  Compass,
  Eye,
  Moon,
  Radar,
  Sparkles,
  Sun,
} from "lucide-react";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import {
  DesktopDeviceMockup,
  PhoneDeviceMockup,
} from "@/components/landing/device-mockups";
import { AssemblyNarrative } from "@/components/landing/hero-assembly-narrative";
import { HeroSignalCards } from "@/components/landing/hero-signal-cards";
import { HeroTwinCutout } from "@/components/landing/hero-twin-cutout";
import { ClosingTwinPath } from "@/components/landing/closing-twin-path";
import { EditorialScrollThread } from "@/components/landing/editorial-scroll-thread";
import { LandingImageLoader } from "@/components/landing/landing-image-loader";
import {
  LandingHeroParallax,
  type HeroSceneLayer,
} from "@/components/landing/multilayer-parallax";
import {
  PageTransitionProvider,
  usePageTransition,
} from "@/components/landing/page-transition-overlay";
import currentProductCapture from "../../docs/release/evidence/current-cognitive-product-desktop.png";
import currentMobileCapture from "../../docs/audit-evidence/visual-restoration-final/02-dashboard-mobile.png";

type LandingLocale = "en" | "es";
type LandingTheme = "dark" | "light";

const PREMIUM_EASE = [0.4, 0, 0.2, 1] as const;
const PIN_SPRING = { stiffness: 100, damping: 28, mass: 0.5 } as const;
const HEADING_STYLE = { color: "var(--landing-heading)" } as const;
const MUTED_STYLE = { color: "var(--landing-muted)" } as const;
const SUBTLE_STYLE = { color: "var(--landing-subtle)" } as const;

const LANDING_COPY = {
  en: {
    nav: {
      home: "Novo, home",
      how: "How it works",
      product: "Product",
      plans: "Plans",
      signIn: "Sign in",
      start: "Start my Twin",
      language: "Change language",
      theme: "Switch color theme",
    },
    hero: {
      eyebrow: "The next interface for AI is not another chat.",
      headline: "Shared context.",
      body: "Novo builds a Twin that learns from what you do and adapts the next decision. Your day changes; its understanding changes with it.",
      primary: "Start my Twin",
      secondary: "See how it learns",
    },
    twin: {
      connected: "Your context, connected",
      learning: "Learning",
      explore: "Explore",
      connectedSignals: "The Twin connected 7 signals to get here",
      nodes: {
        now: ["Current context", "What changed today"],
        intent: ["Intent", "Ship Novo"],
        focus: ["Pattern", "Focus window"],
        evidence: ["Evidence", "Verified work"],
        outcome: ["Outcome", "Blocker resolved"],
        learning: ["Learning", "Rhythm confirmed"],
        direction: ["Direction", "Next action"],
      },
    },
    rail: {
      label: "A memory that lives where you already work",
      items: [
        ["Tasks", "What needs to move"],
        ["Calendar", "The time you have"],
        ["Notes", "What you do not want to lose"],
        ["MCP", "What Novo can do"],
      ],
    },
    thesis: {
      eyebrow: "The difference is not answering faster",
      title: "It is not starting from zero.",
      body: "Novo keeps intent, evidence, and outcomes together. Context does not disappear when a conversation ends.",
    },
    flow: {
      eyebrow: "From noise to direction",
      title: "Intelligence appears when the pieces stop being isolated.",
      body: "You should not have to explain your life to another window. Novo learns from the thread already present in your decisions.",
      items: [
        [
          "01 · Signal",
          "The day leaves clues.",
          "A task moves, a meeting ends late, a note returns. Novo notices what is already happening.",
          "Live input",
        ],
        [
          "02 · Relationship",
          "The Twin finds the thread.",
          "It does not blend everything together. It weighs evidence, connects what matters, and keeps every reading explainable.",
          "Relational memory",
        ],
        [
          "03 · Direction",
          "The next step comes into view.",
          "Instead of another generic answer, you get one concrete decision for the energy and time you have now.",
          "Verifiable action",
        ],
      ],
    },
    editorial: {
      eyebrow: "The operating surface",
      title: "Your work already contains the signal.",
      body: "Novo notices the movement between plans, notes, results, and the tools you choose to connect. It turns the trace into a legible next move — without pretending it knows more than the evidence allows.",
      cardEyebrow: "A decision, not a feed",
      cardTitle: "Protect the release window",
      cardBody:
        "You have 92 minutes before the next meeting. Finish the consent flow test, then capture the proof.",
      source: "Grounded in tasks, calendar, and verified work",
      imageAlt:
        "Original editorial desk scene with a notebook, laptop, and green glass object",
    },
    sequence: {
      eyebrow: "A living model, not a profile",
      title: "It learns from the difference between intention and reality.",
      body: "The Twin connects what you meant to do with what actually happened. That difference changes the next decision.",
      steps: [
        [
          "Observe",
          "Receives signals from work, habits, and the connections you choose.",
        ],
        [
          "Understand",
          "Relates intent, energy, evidence, and outcomes in a continuous context.",
        ],
        [
          "Guide",
          "Turns that context into one clear next action for the present moment.",
        ],
        [
          "Learn",
          "Every outcome corrects or reinforces what the Twin understands about you.",
        ],
      ],
    },
    product: {
      title: "You can see what it knows. And why.",
      body: "The Cognitive Center turns memory, patterns, and evidence into a map you can explore, correct, and grow.",
      points: [
        "Nodes with visible provenance",
        "Relationships that explain every recommendation",
        "Learning that changes with real outcomes",
      ],
      figure: ["Cognitive Center", "Context, evidence, and next action"],
      views: ["01 · Overview", "02 · Focus"],
    },
    mask: {
      title: "CONTEXT",
      body: "Less explaining. More continuity between what you think, do, and learn.",
    },
    editorialTwo: {
      eyebrow: "Memory you can inspect",
      title: "Understanding you does not mean deciding for you.",
      body: "Novo makes its reasoning legible, revisable, and bounded by your approval.",
      imageAlt:
        "Original editorial glass topographic object on paper with an abstract relation diagram",
      principles: [
        [
          "Inspectable",
          "Every recommendation preserves facts, inferences, and evidence.",
        ],
        [
          "Correctable",
          "You can change an interpretation and that correction returns to the Twin.",
        ],
        [
          "Under your control",
          "External actions require confirmation and leave a trail.",
        ],
      ],
    },
    prices: {
      free: "Novo Free",
      freePeriod: "to start",
      freeBody:
        "Create your first cognitive profile, organize the day, and see whether Novo understands your rhythm.",
      freeAction: "Create free account",
      pro: "Novo Pro",
      period: "per month",
      proBody:
        "For using the Twin with complete context, deeper history, and unlimited AI actions.",
      proFeatures: [
        "Full Twin mode",
        "Advanced cognitive map",
        "Analytics history",
        "Unlimited AI actions",
      ],
      proAction: "Choose Pro",
    },
    final: {
      title: "Stop rebuilding your context.",
      body: "Build a relationship with an AI that can learn, explain, and reconsider with you.",
      action: "Start my Twin",
    },
    footer: {
      signIn: "Sign in",
      create: "Create account",
      how: "How it works",
      product: "Product",
      plans: "Plans",
      terms: "Terms",
      privacy: "Privacy",
      refunds: "Refunds",
    },
  },
  es: {
    nav: {
      home: "Novo, inicio",
      how: "Cómo funciona",
      product: "Producto",
      plans: "Planes",
      signIn: "Entrar",
      start: "Crear mi Twin",
      language: "Cambiar idioma",
      theme: "Cambiar tema de color",
    },
    hero: {
      eyebrow: "La próxima interfaz para la IA no es otro chat.",
      headline: "Es contexto compartido.",
      body: "Novo construye un Twin que aprende de lo que haces y adapta cada siguiente decisión. Tu día cambia; su comprensión también.",
      primary: "Crear mi Twin",
      secondary: "Ver cómo aprende",
    },
    twin: {
      connected: "Tu contexto, conectado",
      learning: "Aprendiendo",
      explore: "Explorar",
      connectedSignals: "El Twin conectó 7 señales para llegar aquí",
      nodes: {
        now: ["Contexto actual", "Lo que cambió hoy"],
        intent: ["Intención", "Publicar Novo"],
        focus: ["Patrón", "Ventana de enfoque"],
        evidence: ["Evidencia", "Trabajo verificado"],
        outcome: ["Resultado", "Bloqueo resuelto"],
        learning: ["Aprendizaje", "Ritmo confirmado"],
        direction: ["Dirección", "Siguiente acción"],
      },
    },
    rail: {
      label: "Una memoria que vive donde ya vives",
      items: [
        ["Tareas", "Lo que debes mover"],
        ["Calendario", "El tiempo que tienes"],
        ["Notas", "Lo que no quieres perder"],
        ["MCP", "Lo que Novo puede hacer"],
      ],
    },
    thesis: {
      eyebrow: "La diferencia no es responder más rápido",
      title: "Es dejar de empezar desde cero.",
      body: "Novo mantiene intención, evidencia y resultados unidos. El contexto no desaparece cuando termina una conversación.",
    },
    flow: {
      eyebrow: "Del ruido a la dirección",
      title:
        "La inteligencia aparece cuando las piezas dejan de estar aisladas.",
      body: "No necesitas contarle tu vida a otra ventana. Novo aprende del hilo que ya existe entre tus decisiones.",
      items: [
        [
          "01 · Señal",
          "El día deja pistas.",
          "Una tarea que se mueve, una reunión que termina tarde, una nota que vuelve a aparecer. Novo recoge lo que ya está pasando.",
          "Entrada viva",
        ],
        [
          "02 · Relación",
          "El Twin encuentra el hilo.",
          "No mezcla todo. Pesa la evidencia, conecta lo que importa y mantiene visible de dónde viene cada lectura.",
          "Memoria relacional",
        ],
        [
          "03 · Dirección",
          "Aparece el siguiente paso.",
          "En lugar de otra respuesta genérica, recibes una decisión concreta para la energía y el tiempo que tienes ahora.",
          "Acción verificable",
        ],
      ],
    },
    editorial: {
      eyebrow: "La superficie operativa",
      title: "Tu trabajo ya contiene la señal.",
      body: "Novo observa el movimiento entre planes, notas, resultados y las herramientas que eliges conectar. Convierte el rastro en un siguiente paso legible, sin fingir que sabe más de lo que la evidencia permite.",
      cardEyebrow: "Una decisión, no un feed",
      cardTitle: "Protege la ventana de lanzamiento",
      cardBody:
        "Tienes 92 minutos antes de la próxima reunión. Termina la prueba del flujo de consentimiento y luego captura la evidencia.",
      source: "Basado en tareas, calendario y trabajo verificado",
      imageAlt:
        "Escena editorial original de escritorio con cuaderno, portátil y objeto de vidrio verde",
    },
    sequence: {
      eyebrow: "Un modelo vivo, no un perfil",
      title: "Aprende de la diferencia entre intención y realidad.",
      body: "El Twin conecta lo que querías hacer con lo que realmente ocurrió. Esa diferencia cambia la siguiente decisión.",
      steps: [
        [
          "Observa",
          "Recibe señales del trabajo, los hábitos y las conexiones que eliges.",
        ],
        [
          "Comprende",
          "Relaciona intención, energía, evidencia y resultados en un contexto continuo.",
        ],
        [
          "Guía",
          "Convierte ese contexto en una siguiente acción clara para el momento actual.",
        ],
        [
          "Aprende",
          "Cada resultado corrige o refuerza lo que el Twin entiende de ti.",
        ],
      ],
    },
    product: {
      title: "Puedes ver qué sabe. Y por qué lo sabe.",
      body: "El Centro Cognitivo convierte memoria, patrones y evidencia en un mapa que puedes explorar, corregir y hacer crecer.",
      points: [
        "Nodos con procedencia visible",
        "Relaciones que explican cada recomendación",
        "Aprendizajes que cambian con resultados reales",
      ],
      figure: ["Centro Cognitivo", "Contexto, evidencia y siguiente acción"],
      views: ["01 · Vista general", "02 · En foco"],
    },
    mask: {
      title: "CONTEXTO",
      body: "Menos explicación. Más continuidad entre lo que piensas, haces y aprendes.",
    },
    editorialTwo: {
      eyebrow: "Memoria que puedes inspeccionar",
      title: "Entenderte no significa decidir por ti.",
      body: "Novo hace su razonamiento legible, corregible y limitado por tu aprobación.",
      imageAlt:
        "Objeto editorial original de vidrio topográfico sobre papel con un diagrama de relaciones abstracto",
      principles: [
        [
          "Inspectable",
          "Cada recomendación conserva hechos, inferencias y evidencia.",
        ],
        [
          "Corregible",
          "Puedes cambiar una interpretación y ese cambio vuelve al Twin.",
        ],
        [
          "Bajo tu control",
          "Las acciones externas requieren confirmación y dejan trazabilidad.",
        ],
      ],
    },
    prices: {
      free: "Novo Free",
      freePeriod: "para empezar",
      freeBody:
        "Crea tu primer perfil cognitivo, organiza el día y comprueba si Novo entiende tu ritmo.",
      freeAction: "Crear cuenta gratis",
      pro: "Novo Pro",
      period: "al mes",
      proBody:
        "Para usar el Twin con contexto completo, historial amplio y acciones de IA ilimitadas.",
      proFeatures: [
        "Modo Twin completo",
        "Mapa cognitivo avanzado",
        "Historial de analíticas",
        "Acciones de IA ilimitadas",
      ],
      proAction: "Elegir Pro",
    },
    final: {
      title: "Deja de reconstruir tu contexto.",
      body: "Construye una relación con una IA que pueda aprender, explicar y reconsiderar contigo.",
      action: "Crear mi Twin",
    },
    footer: {
      signIn: "Entrar",
      create: "Crear cuenta",
      how: "Cómo funciona",
      product: "Producto",
      plans: "Planes",
      terms: "Términos",
      privacy: "Privacidad",
      refunds: "Reembolsos",
    },
  },
} as const;

type LandingCopy = (typeof LANDING_COPY)[LandingLocale];

const TWIN_LAYOUT = [
  { id: "now", x: 50, y: 50, r: 4.5, tone: "#F4F0E8" },
  { id: "intent", x: 31, y: 29, r: 2.7, tone: "#A6D6B5" },
  { id: "focus", x: 68, y: 28, r: 2.5, tone: "#83B996" },
  { id: "evidence", x: 22, y: 55, r: 2.2, tone: "#789487" },
  { id: "outcome", x: 76, y: 56, r: 2.7, tone: "#DCCF9F" },
  { id: "learning", x: 36, y: 73, r: 2.5, tone: "#B7E4C2" },
  { id: "direction", x: 64, y: 75, r: 3, tone: "#8FCDB8" },
] as const;

const TWIN_EDGES = [
  ["now", "intent"],
  ["now", "focus"],
  ["now", "evidence"],
  ["now", "outcome"],
  ["evidence", "learning"],
  ["outcome", "direction"],
  ["learning", "direction"],
] as const;

const SIGNAL_LAYOUT = [
  { id: "tasks", tone: "#ADEBC1", x: "8%", y: "23%", delay: 0 },
  { id: "calendar", tone: "#DCCF9F", x: "70%", y: "14%", delay: 0.32 },
  { id: "rhythm", tone: "#9ED4C0", x: "72%", y: "69%", delay: 0.64 },
] as const;

const SIGNAL_COPY = {
  en: [
    ["Tasks", "3 open"],
    ["Calendar", "2 blocks"],
    ["Rhythm", "High focus"],
  ],
  es: [
    ["Tareas", "3 abiertas"],
    ["Calendario", "2 bloques"],
    ["Ritmo", "Enfoque alto"],
  ],
} as const;

const FLOW_COLORS = ["#ADEBC1", "#DCCF9F", "#9ED4C0"] as const;
const STEP_ICONS = [Eye, Radar, Compass, Check] as const;
const HERO_HEADLINE = "Es contexto compartido.";
const ASSEMBLY_SECTION_COPY = {
  en: {
    eyebrow: "The connection takes shape",
    title: "A change becomes context. Context becomes a next move.",
    body: "Novo does not collect isolated events. It keeps the relationship between what moved, what it means, and what is worth doing now.",
    mobile: ["A plan moved", "The thread stayed", "A next move formed"],
  },
  es: {
    eyebrow: "La conexion toma forma",
    title:
      "Un cambio se vuelve contexto. El contexto se vuelve siguiente paso.",
    body: "Novo no acumula eventos aislados. Conserva la relacion entre lo que cambio, lo que significa y lo que vale la pena hacer ahora.",
    mobile: ["Un plan cambio", "El hilo siguio", "Surgio el siguiente paso"],
  },
} as const;

/**
 * The landing is an authored desktop scene: its spatial story is part of the
 * product demonstration, not incidental decoration. Desktop therefore keeps
 * the scene motion even when Windows reports its global animation flag off.
 * Compact/touch layouts still respect the system preference in full.
 */
function useLandingReducedMotion() {
  const systemReducedMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop ? false : systemReducedMotion;
}

function LandingTransitionLink({
  href,
  children,
  className,
  style,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { transitionTo } = usePageTransition();

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        transitionTo(href);
      }}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}

function ScrollProgress({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 32,
    mass: 0.25,
  });
  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-px origin-left bg-[#ADEBC1]"
      style={{ scaleX: progress }}
    />
  );
}

function LandingNav({
  copy,
  locale,
  setLocale,
  theme,
  setTheme,
}: {
  copy: LandingCopy;
  locale: LandingLocale;
  setLocale: (locale: LandingLocale) => void;
  theme: LandingTheme;
  setTheme: (theme: LandingTheme) => void;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6">
      <nav
        className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border px-3 shadow-[0_14px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-700 sm:px-5"
        style={{
          backgroundColor: "var(--landing-nav)",
          borderColor: "var(--landing-line)",
          boxShadow: "var(--landing-nav-shadow)",
        }}
      >
        <Link
          href="/landing"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={copy.nav.home}
        >
          <span className="grid size-7 place-items-center overflow-hidden rounded-full border border-[#ADEBC1]/25 bg-[#ADEBC1]/[0.08] transition-transform duration-300 group-hover:scale-[1.04]">
            <Image
              src="/icon.svg"
              alt=""
              width={20}
              height={20}
              className="size-5 object-contain"
              priority
            />
          </span>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.28em]"
            style={HEADING_STYLE}
          >
            Novo
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-4">
          <a
            href="#sistema"
            className="hidden text-sm transition-colors hover:text-[#ADEBC1] sm:block"
            style={MUTED_STYLE}
          >
            {copy.nav.how}
          </a>
          <a
            href="#producto"
            className="hidden text-sm transition-colors hover:text-[#ADEBC1] md:block"
            style={MUTED_STYLE}
          >
            {copy.nav.product}
          </a>
          <a
            href="#precios"
            className="hidden text-sm transition-colors hover:text-[#ADEBC1] lg:block"
            style={MUTED_STYLE}
          >
            {copy.nav.plans}
          </a>
          <LandingTransitionLink
            href="/app"
            className="hidden text-sm transition-colors hover:text-[#ADEBC1] md:block"
            style={MUTED_STYLE}
          >
            {copy.nav.signIn}
          </LandingTransitionLink>
          <div
            className="flex h-8 items-center rounded-full border p-0.5"
            style={{
              borderColor: "var(--landing-line)",
              backgroundColor: "var(--landing-control)",
            }}
            aria-label={copy.nav.language}
          >
            {(["en", "es"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLocale(item)}
                aria-label={item === "en" ? "English" : "Español"}
                aria-pressed={locale === item}
                className="grid h-6 min-w-7 place-items-center rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors"
                style={
                  locale === item
                    ? {
                        backgroundColor: "var(--landing-heading)",
                        color: "var(--landing-inverse)",
                      }
                    : { color: "var(--landing-muted)" }
                }
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            aria-label={copy.nav.theme}
            className="grid size-8 place-items-center rounded-full border transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
            style={{
              borderColor: "var(--landing-line)",
              backgroundColor: "var(--landing-control)",
              color: "var(--landing-heading)",
            }}
          >
            {theme === "dark" ? (
              <Sun className="size-3.5" strokeWidth={1.7} />
            ) : (
              <Moon className="size-3.5" strokeWidth={1.7} />
            )}
          </button>
          <LandingTransitionLink
            href="/auth/signup?callbackUrl=%2Fonboarding"
            className="inline-flex h-9 items-center rounded-full bg-[#ADEBC1] px-3.5 text-[11px] font-semibold text-[#06100c] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.97] sm:px-4 sm:text-xs"
          >
            <span className="hidden sm:inline">{copy.nav.start}</span>
            <span className="sm:hidden">
              {locale === "en" ? "Start" : "Crear"}
            </span>
            <ArrowRight className="ml-1.5 size-3.5" />
          </LandingTransitionLink>
        </div>
      </nav>
    </header>
  );
}

function LandingTwinField({
  copy,
  locale,
}: {
  copy: LandingCopy;
  locale: LandingLocale;
}) {
  const reduceMotion = useLandingReducedMotion();
  const [selectedId, setSelectedId] = useState("now");
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const softX = useSpring(pointerX, { stiffness: 82, damping: 23, mass: 0.75 });
  const softY = useSpring(pointerY, { stiffness: 82, damping: 23, mass: 0.75 });
  const fieldX = useTransform(softX, [-0.5, 0.5], ["39%", "61%"]);
  const fieldY = useTransform(softY, [-0.5, 0.5], ["34%", "62%"]);
  const rotateX = useTransform(softY, [-0.5, 0.5], [1.6, -1.6]);
  const rotateY = useTransform(softX, [-0.5, 0.5], [-1.8, 1.8]);
  const ambientField = useMotionTemplate`radial-gradient(circle at ${fieldX} ${fieldY}, rgba(173,235,193,.18), rgba(7,16,12,0) 43%)`;
  const nodes = TWIN_LAYOUT.map((node) => ({
    ...node,
    label: copy.twin.nodes[node.id][0],
    detail: copy.twin.nodes[node.id][1],
  }));
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  return (
    <motion.div
      data-testid="landing-twin-field"
      aria-label="Explorar el contexto del Twin"
      className="relative mx-auto w-full max-w-[46rem] [perspective:1200px]"
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
        pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
      }}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="relative aspect-[.86/1] rounded-[2.6rem] border border-[#ADEBC1]/[0.12] bg-[#AEEBC1]/[0.035] p-1.5 shadow-[0_42px_140px_rgba(0,0,0,0.42)] sm:aspect-[1.1/1]"
        style={
          reduceMotion
            ? undefined
            : { rotateX, rotateY, backgroundImage: ambientField }
        }
      >
        <div className="relative h-full overflow-hidden rounded-[2.15rem] border border-white/[0.085] bg-[#07110C]/[0.96]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,rgba(173,235,193,.16),transparent_39%),radial-gradient(circle_at_88%_12%,rgba(220,207,159,.08),transparent_28%)]" />
          <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between text-[10px] font-medium text-white/52 sm:inset-x-7 sm:top-7">
            <span className="inline-flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-[7px] border border-white/[0.1] bg-white/[0.04] text-[#ADEBC1]">
                <CircleDot className="size-3" strokeWidth={1.5} />
              </span>
              {copy.twin.connected}
            </span>
            <span className="inline-flex items-center gap-2 text-[#ADEBC1]">
              <span className="landing-motion-layer size-1.5 rounded-full bg-[#ADEBC1]" />
              {copy.twin.learning}
            </span>
          </div>

          {SIGNAL_LAYOUT.map((signal, index) => (
            <motion.div
              key={signal.id}
              className="absolute z-20 hidden min-w-[7.5rem] rounded-[1rem] border border-white/[0.1] bg-[#0C1A13]/[0.86] px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)] sm:block"
              style={{ left: signal.x, top: signal.y }}
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -5, 0], opacity: [0.7, 1, 0.7] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 4.8,
                      delay: signal.delay,
                      repeat: Infinity,
                      ease: PREMIUM_EASE,
                    }
              }
            >
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/38">
                {SIGNAL_COPY[locale][index][0]}
              </p>
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: signal.tone }}
              >
                {SIGNAL_COPY[locale][index][1]}
              </p>
            </motion.div>
          ))}

          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full p-6 pt-11 sm:p-9 sm:pt-14"
            role="group"
          >
            <motion.path
              d="M50 12 C31 5 14 19 15 40 C5 50 12 72 29 76 C34 91 47 88 50 82 C53 88 66 91 71 76 C88 72 95 50 85 40 C86 19 69 5 50 12 Z"
              fill="rgba(173,235,193,.025)"
              stroke="rgba(210,235,218,.24)"
              strokeWidth="0.62"
              strokeDasharray="1.35 2.15"
              initial={
                reduceMotion
                  ? { pathLength: 1, opacity: 1 }
                  : { pathLength: 0.18, opacity: 0.4 }
              }
              animate={{ pathLength: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.15, ease: PREMIUM_EASE }
              }
            />
            <path
              d="M50 13 C46 27 48 41 50 50 C52 61 53 71 50 82"
              fill="none"
              stroke="rgba(210,235,218,.11)"
              strokeDasharray="1 2.4"
              strokeWidth="0.4"
            />
            {TWIN_EDGES.map(([sourceId, targetId], index) => {
              const source = TWIN_LAYOUT.find((node) => node.id === sourceId)!;
              const target = TWIN_LAYOUT.find((node) => node.id === targetId)!;
              const active = selectedId === sourceId || selectedId === targetId;
              return (
                <motion.line
                  key={`${sourceId}-${targetId}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={
                    active ? "rgba(173,235,193,.62)" : "rgba(210,235,218,.22)"
                  }
                  strokeWidth={active ? 0.72 : 0.45}
                  initial={
                    reduceMotion
                      ? { pathLength: 1, opacity: 1 }
                      : { pathLength: 0, opacity: 0 }
                  }
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.72,
                          delay: 0.16 + index * 0.035,
                          ease: PREMIUM_EASE,
                        }
                  }
                />
              );
            })}
            {nodes.map((node, index) => {
              const selected = node.id === selectedId;
              return (
                <motion.g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${node.label}: ${node.detail}`}
                  className="cursor-pointer outline-none"
                  onClick={() => setSelectedId(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(node.id);
                    }
                  }}
                  initial={
                    reduceMotion ? false : { opacity: 0.28, scale: 0.72 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.52,
                          delay: 0.24 + index * 0.035,
                          ease: PREMIUM_EASE,
                        }
                  }
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                >
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r * 2.2}
                    fill={node.tone}
                    animate={
                      reduceMotion || !selected
                        ? { opacity: selected ? 0.18 : 0.055 }
                        : { opacity: [0.12, 0.24, 0.12], scale: [1, 1.1, 1] }
                    }
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 3.2,
                            repeat: Infinity,
                            ease: PREMIUM_EASE,
                          }
                    }
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill={node.tone}
                    opacity={selected ? 1 : 0.78}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 1.2}
                    fill="none"
                    stroke={selected ? "#ADEBC1" : "transparent"}
                    strokeWidth="0.55"
                  />
                </motion.g>
              );
            })}
          </svg>

          <motion.div
            key={selectedNode.id}
            initial={
              reduceMotion ? false : { opacity: 0.45, y: 10, scale: 0.985 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 24, mass: 0.7 }
            }
            className="absolute inset-x-5 bottom-5 z-20 rounded-[1.3rem] border border-white/[0.11] bg-[#0B1811]/[0.92] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_40px_rgba(0,0,0,0.22)] sm:inset-x-7 sm:bottom-7 sm:px-5 sm:py-4"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] text-white/42">
                  {selectedNode.label}
                </p>
                <p className="mt-1 text-sm font-medium text-[#F4F0E8] sm:text-base">
                  {selectedNode.detail}
                </p>
              </div>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#ADEBC1]">
                {copy.twin.explore} <ArrowUpRight className="size-3" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/[0.08] pt-3 text-[10px] text-white/38">
              <Sparkles className="size-3 text-[#DCCF9F]" />
              {copy.twin.connectedSignals}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ContextFlow({
  scrollContainer,
  copy,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 80%", "end 30%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const lineScale = useTransform(progress, [0, 1], [0.12, 1]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-y px-6 py-24 transition-colors duration-700 sm:px-10 lg:px-16 lg:py-36"
      style={{
        backgroundColor: "var(--landing-elevated)",
        borderColor: "var(--landing-line)",
      }}
    >
      <div className="pointer-events-none absolute -left-32 top-1/4 size-[28rem] rounded-full bg-[#ADEBC1]/[0.055] blur-[130px]" />
      <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[.82fr_1.18fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:h-fit">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#ADEBC1]/[0.18] bg-[#ADEBC1]/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F]">
            <Sparkles className="size-3" />
            {copy.flow.eyebrow}
          </p>
          <h2
            className="mt-6 max-w-xl text-[clamp(2.9rem,5.4vw,5.8rem)] font-medium leading-[0.91] tracking-[-0.07em]"
            style={HEADING_STYLE}
          >
            {copy.flow.title}
          </h2>
          <p
            className="mt-7 max-w-md text-lg leading-relaxed"
            style={MUTED_STYLE}
          >
            {copy.flow.body}
          </p>
          <div
            className="relative mt-12 hidden h-40 max-w-sm lg:block"
            aria-hidden="true"
          >
            <div
              className="absolute left-4 top-0 h-full w-px"
              style={{ backgroundColor: "var(--landing-line)" }}
            />
            <motion.div
              className="absolute left-4 top-0 h-full w-px origin-top bg-[#ADEBC1]/70"
              style={reduceMotion ? { scaleY: 1 } : { scaleY: lineScale }}
            />
            <div className="absolute left-0 top-0 grid size-9 place-items-center rounded-full border border-[#ADEBC1]/25 bg-[#ADEBC1]/[0.08] text-[#ADEBC1]">
              <CircleDot className="size-4" />
            </div>
            <div className="absolute left-0 bottom-0 grid size-9 place-items-center rounded-full border border-[#DCCF9F]/25 bg-[#DCCF9F]/[0.08] text-[#DCCF9F]">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
        </div>
        <div className="relative grid gap-7 lg:gap-9 lg:px-8">
          <EditorialScrollThread
            progress={progress}
            reduceMotion={reduceMotion}
            variant="flow"
            className="-inset-y-3 -left-5 hidden h-[calc(100%+1.5rem)] w-[calc(100%+2.5rem)] lg:block"
          />
          {copy.flow.items.map(([eyebrow, title, body, footer], index) => (
            <motion.article
              key={eyebrow}
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0.28,
                      y: 18,
                      scale: 0.988,
                      filter: "blur(3px)",
                    }
              }
              whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.22 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.58, delay: index * 0.065, ease: PREMIUM_EASE }
              }
              className={`group relative z-10 overflow-hidden rounded-[1.8rem] border p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,border-color,background-color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 sm:p-8 ${index === 1 ? "lg:ml-7 lg:-mr-7" : "lg:mr-5"}`}
              style={{
                borderColor: "var(--landing-line)",
                backgroundColor: "var(--landing-card)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full blur-3xl"
                style={{ backgroundColor: `${FLOW_COLORS[index]}12` }}
              />
              <div className="relative grid gap-8 sm:grid-cols-[5rem_1fr] sm:gap-7">
                <div className="flex items-start sm:block">
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.16em]"
                    style={{ color: FLOW_COLORS[index] }}
                  >
                    {eyebrow}
                  </span>
                </div>
                <div>
                  <h3
                    className="max-w-lg text-3xl font-medium leading-[0.98] tracking-[-0.05em]"
                    style={HEADING_STYLE}
                  >
                    {title}
                  </h3>
                  <p
                    className="mt-4 max-w-lg text-base leading-relaxed sm:text-lg"
                    style={MUTED_STYLE}
                  >
                    {body}
                  </p>
                </div>
              </div>
              <div
                className="relative mt-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.15em]"
                style={SUBTLE_STYLE}
              >
                <span
                  className="h-px flex-1"
                  style={{ backgroundColor: "var(--landing-line)" }}
                />
                <span>{footer}</span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditorialMoment({
  scrollContainer,
  copy,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-9%", "8%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.18]);
  const ambientY = useTransform(scrollYProgress, [0, 1], ["10%", "-14%"]);
  const cardY = useTransform(scrollYProgress, [0, 1], ["11%", "-7%"]);
  const diagramX = useTransform(scrollYProgress, [0, 1], ["-4%", "5%"]);

  return (
    <section
      ref={sectionRef}
      className="relative px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36"
    >
      <div
        className="relative mx-auto min-h-[42rem] max-w-7xl overflow-hidden rounded-[2.25rem] border shadow-[0_32px_100px_rgba(0,0,0,0.22)]"
        style={{
          borderColor: "var(--landing-line)",
          backgroundColor: "var(--landing-card)",
        }}
      >
        <motion.div
          className="absolute inset-x-0 -top-[10%] h-[120%]"
          style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}
        >
          <Image
            src="/landing/novo-editorial-context.webp"
            alt={copy.editorial.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover object-center"
          />
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,13,9,.92)_0%,rgba(5,13,9,.7)_37%,rgba(5,13,9,.12)_71%,rgba(5,13,9,.32)_100%)]" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-20 size-[31rem] rounded-full bg-[#ADEBC1]/[0.12] blur-[120px]"
          style={reduceMotion ? undefined : { y: ambientY }}
        />
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 120 80"
          className="pointer-events-none absolute bottom-6 right-0 hidden h-[19rem] w-[38rem] opacity-50 lg:block"
          style={reduceMotion ? undefined : { x: diagramX }}
        >
          <path
            d="M6 66 C23 36 38 54 49 37 S72 8 88 25 S104 41 118 12"
            fill="none"
            stroke="rgba(210,235,218,.56)"
            strokeDasharray="1.2 2.2"
            strokeWidth=".45"
          />
          <path
            d="M10 62 L42 50 L67 28 L102 35"
            fill="none"
            stroke="rgba(173,235,193,.34)"
            strokeWidth=".4"
          />
          {[
            ["10", "62", "3"],
            ["42", "50", "2.2"],
            ["67", "28", "3.2"],
            ["102", "35", "2.6"],
          ].map(([cx, cy, r]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="rgba(173,235,193,.72)"
            />
          ))}
        </motion.svg>
        <div className="relative grid min-h-[42rem] items-end gap-12 p-7 sm:p-12 lg:grid-cols-[1fr_.78fr] lg:items-center lg:p-16">
          <div className="relative z-10 max-w-xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.19em] text-[#ADEBC1]">
              {copy.editorial.eyebrow}
            </p>
            <h2 className="mt-6 text-[clamp(3rem,5.4vw,5.6rem)] font-medium leading-[0.9] tracking-[-0.075em] text-[#F4F0E8]">
              {copy.editorial.title}
            </h2>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/70">
              {copy.editorial.body}
            </p>
          </div>
          <motion.aside
            className="relative z-10 rounded-[1.55rem] border border-white/[0.14] bg-[#07110C]/[0.8] p-5 shadow-[0_24px_64px_rgba(0,0,0,.25)] backdrop-blur-md sm:p-6"
            style={reduceMotion ? undefined : { y: cardY }}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#ADEBC1]">
              {copy.editorial.cardEyebrow}
            </p>
            <div className="mt-5 flex items-start gap-3">
              <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-[#ADEBC1]/20 text-[#ADEBC1]">
                <CircleDot className="size-3.5" />
              </span>
              <div>
                <h3 className="text-xl font-medium tracking-[-0.035em] text-[#F4F0E8]">
                  {copy.editorial.cardTitle}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/62">
                  {copy.editorial.cardBody}
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-white/[0.1] pt-4 text-[10px] text-white/46">
              <span className="mr-2 inline-block size-1.5 rounded-full bg-[#ADEBC1]" />
              {copy.editorial.source}
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  );
}

function CognitiveSequence({
  scrollContainer,
  copy,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 78%", "end 35%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const lineScale = useTransform(progress, [0, 1], [0.08, 1]);
  const orbit = useTransform(progress, [0, 1], [-10, 18]);
  const variants = {
    hidden: { opacity: 0.5, y: 24, clipPath: "inset(0 0 12% 0)" },
    visible: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" },
  };

  return (
    <section
      ref={sectionRef}
      id="sistema"
      data-testid="cognitive-sequence"
      className="relative overflow-hidden px-6 py-24 sm:px-10 lg:px-16 lg:py-36"
    >
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:h-fit">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F]">
            {copy.sequence.eyebrow}
          </p>
          <h2
            className="mt-6 max-w-xl text-[clamp(2.9rem,5.1vw,5.5rem)] font-medium leading-[0.91] tracking-[-0.07em]"
            style={HEADING_STYLE}
          >
            {copy.sequence.title}
          </h2>
          <p
            className="mt-7 max-w-md text-base leading-relaxed sm:text-lg"
            style={MUTED_STYLE}
          >
            {copy.sequence.body}
          </p>
          <div
            className="relative mt-12 hidden h-40 max-w-sm lg:block"
            aria-hidden="true"
          >
            <div
              className="absolute left-4 top-0 h-full w-px"
              style={{ backgroundColor: "var(--landing-line)" }}
            />
            <motion.div
              className="absolute left-4 top-0 h-full w-px origin-top bg-[#ADEBC1]/65"
              style={{ scaleY: reduceMotion ? 1 : lineScale }}
            />
            <motion.div
              className="absolute left-0 top-5 size-8 rounded-full border border-[#ADEBC1]/28 bg-[#ADEBC1]/[0.08]"
              style={reduceMotion ? undefined : { y: orbit }}
            />
          </div>
        </div>
        <div className="relative grid gap-5 lg:px-7">
          <EditorialScrollThread
            progress={progress}
            reduceMotion={reduceMotion}
            variant="sequence"
            className="-inset-y-3 -left-3 hidden h-[calc(100%+1.5rem)] w-[calc(100%+1.5rem)] lg:block"
          />
          {copy.sequence.steps.map(([title, body], index) => {
            const Icon = STEP_ICONS[index];
            return (
              <motion.article
                key={title}
                variants={variants}
                initial={reduceMotion ? false : "hidden"}
                whileInView="visible"
                viewport={{ once: true, amount: 0.42 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.65,
                        delay: index * 0.055,
                        ease: PREMIUM_EASE,
                      }
                }
                className={`group relative z-10 grid min-h-44 grid-cols-[2.8rem_1fr] gap-5 rounded-[1.6rem] border p-6 transition-[border-color,background-color,transform] duration-500 hover:-translate-y-0.5 sm:grid-cols-[3.2rem_1fr] sm:p-8 ${index % 2 === 1 ? "lg:mr-7 lg:-ml-7" : "lg:ml-5"}`}
                style={{
                  borderColor: "var(--landing-line)",
                  backgroundColor: "var(--landing-card)",
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full border border-[#ADEBC1]/18 bg-[#ADEBC1]/[0.055] text-[#ADEBC1] transition-transform duration-500 group-hover:scale-[1.06]">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[9px] font-medium tracking-[0.14em] text-[#71D88F]/60">
                    0{index + 1}
                  </span>
                </div>
                <div>
                  <h3
                    className="text-2xl font-medium tracking-[-0.04em]"
                    style={HEADING_STYLE}
                  >
                    {title}
                  </h3>
                  <p
                    className="mt-4 max-w-md text-sm leading-relaxed sm:text-base"
                    style={MUTED_STYLE}
                  >
                    {body}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductWindow({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: LandingCopy;
}) {
  const reduceMotion = useLandingReducedMotion();
  const richOpacity = useTransform(progress, [0.08, 0.56], [0.72, 1]);
  const overviewY = useTransform(progress, [0, 1], [14, -10]);
  const mobileY = useTransform(progress, [0, 1], [26, -18]);
  const mobileRotate = useTransform(progress, [0, 1], [3.5, -1.5]);
  // This replaces final-cognitive-preview-desktop.png: the sparse graph was a prior
  // state, while this current capture is the single, truthful product evidence.
  return (
    <div className="relative pb-4 pt-2 lg:pb-10">
      <motion.div
        initial={false}
        whileInView={{
          clipPath: "inset(0 0 0 0 round 1.75rem)",
          opacity: 1,
          y: 0,
        }}
        viewport={{ once: true, amount: 0.2 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.8, ease: PREMIUM_EASE }
        }
        className="relative z-10 lg:mr-14"
        style={
          reduceMotion ? undefined : { y: overviewY, opacity: richOpacity }
        }
      >
        <DesktopDeviceMockup
          image={currentProductCapture}
          alt="Centro Cognitivo real de Novo con el cerebro navegable del Twin"
          label={copy.product.views[0]}
        />
        <div
          className="flex flex-col gap-1 px-5 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={SUBTLE_STYLE}
        >
          <span>{copy.product.figure[0]}</span>
          <span>{copy.product.figure[1]}</span>
        </div>
      </motion.div>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 34, rotate: 5 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.32 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.76, delay: 0.12, ease: PREMIUM_EASE }
        }
        className="relative z-20 -mt-16 ml-auto mr-3 w-[35%] min-w-[9rem] lg:absolute lg:-bottom-4 lg:-right-3 lg:mt-0 lg:mr-0 lg:w-[30%]"
        style={reduceMotion ? undefined : { y: mobileY, rotate: mobileRotate }}
      >
        <PhoneDeviceMockup
          image={currentMobileCapture}
          alt="Dashboard móvil real de Novo con la recomendación actual del Twin"
          label={copy.product.views[1]}
        />
      </motion.div>
    </div>
  );
}

function ProductSection({
  scrollContainer,
  copy,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  return (
    <div
      ref={sectionRef}
      id="producto"
      className={reduceMotion ? "" : "relative h-[150dvh]"}
    >
      <section
        className={`relative overflow-hidden border-y px-6 sm:px-10 lg:px-16 ${reduceMotion ? "py-24 lg:py-32" : "sticky top-0 flex min-h-dvh items-start pb-6 pt-20 lg:items-center lg:py-16"}`}
        style={{
          backgroundColor: "var(--landing-elevated)",
          borderColor: "var(--landing-line)",
        }}
      >
        <div className="pointer-events-none absolute -right-40 top-1/4 size-[36rem] rounded-full bg-[#ADEBC1]/[0.055] blur-[160px]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[.77fr_1.23fr] lg:items-center lg:gap-20">
          <EditorialScrollThread
            progress={progress}
            reduceMotion={reduceMotion}
            variant="product"
            className="inset-x-[27%] top-[13%] hidden h-[76%] w-[61%] lg:block"
          />
          <motion.div
            className="relative z-10"
            initial={reduceMotion ? false : { opacity: 0.65, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.72, ease: PREMIUM_EASE }
            }
          >
            <h2
              className="max-w-lg text-[clamp(2.7rem,4.8vw,5rem)] font-medium leading-[0.94] tracking-[-0.065em]"
              style={HEADING_STYLE}
            >
              {copy.product.title}
            </h2>
            <p
              className="mt-7 max-w-md text-lg leading-relaxed"
              style={MUTED_STYLE}
            >
              {copy.product.body}
            </p>
            <div className="mt-8 grid gap-3 text-sm" style={MUTED_STYLE}>
              {copy.product.points.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-full border border-[#ADEBC1]/18 text-[#ADEBC1]">
                    <Check className="size-3.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
          <div className="relative z-10">
            <ProductWindow progress={progress} copy={copy} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ContextMask({
  progress,
  copy,
  locale,
}: {
  progress: MotionValue<number>;
  copy: LandingCopy;
  locale: LandingLocale;
}) {
  const reduceMotion = useLandingReducedMotion();
  const supportingOpacity = useTransform(progress, [0, 0.16, 0.38], [1, 1, 0]);
  const supportingY = useTransform(progress, [0, 0.38], [0, -24]);
  return (
    <div
      className={reduceMotion ? "relative" : "relative h-[150dvh] lg:h-[176dvh]"}
    >
      <section
        className={`relative isolate overflow-hidden rounded-[2rem] border px-5 py-14 sm:px-10 sm:py-20 ${reduceMotion ? "min-h-[38rem]" : "sticky top-8 min-h-[calc(100dvh-4rem)]"}`}
        style={{
          borderColor: "var(--landing-line)",
          backgroundColor: "transparent",
        }}
      >
        <div className="relative z-10 mx-auto flex min-h-[30rem] max-w-6xl flex-col items-center justify-center text-center">
          <motion.p
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]"
            style={
              reduceMotion
                ? { borderColor: "var(--landing-line)", color: "var(--landing-muted)" }
                : {
                    opacity: supportingOpacity,
                    y: supportingY,
                    borderColor: "var(--landing-line)",
                    color: "var(--landing-muted)",
                  }
            }
          >
            <span className="size-1.5 rounded-full bg-[#71D88F]" />
            {locale === "es" ? "Entrar en el campo compartido" : "Enter the shared field"}
          </motion.p>

          <h2 className="sr-only">{copy.mask.title}</h2>
          <div aria-hidden="true" className="h-[clamp(5rem,15vw,13rem)] w-full" />

          <motion.p
            className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed sm:text-xl"
            style={
              reduceMotion
                ? MUTED_STYLE
                : {
                    ...MUTED_STYLE,
                    opacity: supportingOpacity,
                    y: supportingY,
                  }
            }
          >
            {copy.mask.body}
          </motion.p>

          <motion.div
            aria-hidden="true"
            className="mt-10 h-px w-20 bg-[#71D88F]/50"
            style={reduceMotion ? undefined : { opacity: supportingOpacity }}
          />
        </div>
      </section>
    </div>
  );
}

function SharedContextPortal({
  progress,
  locale,
  reduceMotion,
}: {
  progress: MotionValue<number>;
  locale: LandingLocale;
  reduceMotion: boolean;
}) {
  const radius = useTransform(progress, [0, 0.14, 0.46, 0.58], [0, 0, 42, 145]);
  const scale = useTransform(progress, [0, 0.24, 0.58, 0.84], [1.16, 1.13, 1, 1.04]);
  const y = useTransform(progress, [0, 0.58, 0.84], ["4%", "0%", "-3%"]);
  const opacity = useTransform(progress, [0, 0.7, 0.9], [1, 1, 0]);
  const veilOpacity = useTransform(progress, [0.48, 0.72], [0, 0.78]);
  const portalWord = locale === "es" ? "CONTEXTO" : "CONTEXT";
  const textMask = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360"><text x="600" y="255" text-anchor="middle" font-family="Arial,sans-serif" font-size="250" font-weight="800" letter-spacing="-16" textLength="1080" lengthAdjust="spacingAndGlyphs" fill="white">${portalWord}</text></svg>`,
  )}")`;
  const portalMask = useMotionTemplate`${textMask}, radial-gradient(circle at 62% 50%, #000 0%, #000 ${radius}%, transparent calc(${radius}% + 0.7%))`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none sticky top-0 h-dvh overflow-hidden"
      style={{ backgroundColor: "var(--landing-card)" }}
    >
      <motion.div
        data-testid="context-shared-field"
        className="absolute inset-0 overflow-hidden will-change-transform"
        style={{
          opacity: reduceMotion ? 1 : opacity,
          scale: reduceMotion ? 1 : scale,
          y: reduceMotion ? 0 : y,
          WebkitMaskImage: reduceMotion ? "none" : portalMask,
          maskImage: reduceMotion ? "none" : portalMask,
          WebkitMaskPosition: "center, center",
          maskPosition: "center, center",
          WebkitMaskRepeat: "no-repeat, no-repeat",
          maskRepeat: "no-repeat, no-repeat",
          WebkitMaskSize: "92% auto, 100% 100%",
          maskSize: "92% auto, 100% 100%",
          WebkitMaskComposite: "source-over",
          maskComposite: "add",
        }}
      >
        <Image
          src="/landing/novo-context-portal-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,var(--landing-elevated)_100%)]"
        style={{ opacity: reduceMotion ? 0.28 : veilOpacity }}
      />
    </div>
  );
}

function ContextSystemJourney({
  scrollContainer,
  copy,
  locale,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
  locale: LandingLocale;
}) {
  const journeyRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: journeyRef,
    container: scrollContainer,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);

  return (
    <section ref={journeyRef} className="relative">
      <SharedContextPortal
        progress={progress}
        locale={locale}
        reduceMotion={reduceMotion ?? false}
      />
      <div className="relative z-10 -mt-[100dvh]">
        <section className="px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <ContextMask progress={progress} copy={copy} locale={locale} />
          </div>
        </section>
        <CognitiveSequence scrollContainer={scrollContainer} copy={copy} />
      </div>
    </section>
  );
}

function HeroWord({
  word,
  index,
  heroReady,
  isLast,
}: {
  word: string;
  index: number;
  heroReady: boolean;
  isLast: boolean;
}) {
  const reduceMotion = useLandingReducedMotion();
  return (
    <motion.span
      className="inline-block overflow-hidden align-[-0.08em]"
      style={{ marginRight: isLast ? 0 : "0.22em" }}
    >
      <motion.span
        initial={false}
        animate={{ y: reduceMotion || heroReady ? "0%" : "112%" }}
        transition={
          reduceMotion || !heroReady
            ? { duration: 0 }
            : {
                duration: 0.82,
                delay: 0.12 + index * 0.075,
                ease: [0.16, 1, 0.3, 1],
              }
        }
        className="inline-block"
      >
        {word}
      </motion.span>
    </motion.span>
  );
}

function useSceneScrollProgress(
  targetRef: RefObject<HTMLElement | null>,
  scrollContainer: RefObject<HTMLDivElement | null>,
) {
  const progress = useMotionValue(0);

  useEffect(() => {
    const target = targetRef.current;
    const container = scrollContainer.current;
    if (!target || !container) return;

    let scheduledFrame = 0;
    let loopFrame = 0;
    let sceneVisible = true;
    const update = () => {
      const containerRect = container.getBoundingClientRect();
      // Lenis normally scrolls the landing wrapper. The document fallback keeps
      // the scene alive when a desktop browser delegates wheel scroll to its
      // page scroller instead of the nested landing wrapper.
      const documentScroll =
        document.scrollingElement?.scrollTop ?? window.scrollY;
      const usesDocumentScroll = documentScroll > container.scrollTop;
      const currentScroll = usesDocumentScroll
        ? documentScroll
        : container.scrollTop;
      const targetTop = usesDocumentScroll
        ? target.getBoundingClientRect().top + documentScroll
        : target.getBoundingClientRect().top -
          containerRect.top +
          container.scrollTop;
      const travel = Math.max(1, target.offsetHeight - container.clientHeight);
      progress.set(
        Math.min(1, Math.max(0, (currentScroll - targetTop) / travel)),
      );
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(update);
    };
    const updateWhileVisible = () => {
      if (!sceneVisible) {
        loopFrame = 0;
        return;
      }
      update();
      loopFrame = requestAnimationFrame(updateWhileVisible);
    };
    const startVisibleLoop = () => {
      if (sceneVisible && loopFrame === 0) {
        loopFrame = requestAnimationFrame(updateWhileVisible);
      }
    };

    scheduleUpdate();
    startVisibleLoop();
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const observer = new ResizeObserver(scheduleUpdate);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        sceneVisible = entry.isIntersecting;
        if (sceneVisible) {
          scheduleUpdate();
          startVisibleLoop();
        } else if (loopFrame) {
          cancelAnimationFrame(loopFrame);
          loopFrame = 0;
        }
      },
      { root: container },
    );
    observer.observe(target);
    observer.observe(container);
    visibilityObserver.observe(target);
    return () => {
      cancelAnimationFrame(scheduledFrame);
      cancelAnimationFrame(loopFrame);
      observer.disconnect();
      visibilityObserver.disconnect();
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [progress, scrollContainer, targetRef]);

  return progress;
}

function HeroSection({
  scrollContainer,
  copy,
  locale,
  heroReady,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
  locale: LandingLocale;
  heroReady: boolean;
}) {
  const pinRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const scrollYProgress = useSceneScrollProgress(pinRef, scrollContainer);
  // Lenis already supplies eased physical scrolling. Keeping this value direct
  // lets desktop wheel movement update every plane in the same rendered frame.
  const progress = scrollYProgress;
  // Independently cut image planes form the scene. On scroll every layer travels
  // upward in the same camera direction; distance controls travel, so the close
  // planes pass the furthest planes rather than moving as one flat wallpaper.
  const atmosphereY = useTransform(progress, [0, 1], ["-2%", "-8%"]);
  const atmosphereScale = useTransform(progress, [0, 1], [1.015, 1.06]);
  const sunY = useTransform(progress, [0, 1], ["0%", "-12%"]);
  const cloudsY = useTransform(progress, [0, 1], ["2%", "-18%"]);
  const cloudsX = useTransform(progress, [0, 1], ["-1%", "2%"]);
  const mountainsY = useTransform(progress, [0, 1], ["4%", "-26%"]);
  const pinesY = useTransform(progress, [0, 1], ["6%", "-34%"]);
  const ridgeY = useTransform(progress, [0, 1], ["9%", "-45%"]);
  const woodlandY = useTransform(progress, [0, 1], ["12%", "-56%"]);
  const woodlandScale = useTransform(progress, [0, 1], [1.01, 1.12]);
  const leftY = useTransform(progress, [0, 1], ["14%", "-68%"]);
  const leftX = useTransform(progress, [0, 1], ["-2%", "5%"]);
  const rightY = useTransform(progress, [0, 1], ["15%", "-74%"]);
  const rightX = useTransform(progress, [0, 1], ["2%", "-5%"]);
  const leafLeftY = useTransform(progress, [0, 1], ["18%", "-88%"]);
  const leafLeftX = useTransform(progress, [0, 1], ["-4%", "7%"]);
  const copyY = useTransform(progress, [0, 1], [0, -18]);
  const sceneLayers: HeroSceneLayer[] = [
    {
      id: "atmosphere",
      className: "inset-0 -z-30 overflow-hidden opacity-90",
      style: { y: atmosphereY, scale: atmosphereScale },
      content: (
        <Image
          src="/landing/novo-hero-atmosphere-v1.webp"
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "sun",
      className: "inset-0 -z-20 overflow-hidden",
      style: { y: sunY },
      content: (
        <div className="absolute left-[54%] top-[8%] size-[28rem] rounded-full bg-[#DDF1AC]/40 blur-3xl" />
      ),
    },
    {
      id: "clouds",
      className: "inset-0 -z-20 overflow-hidden opacity-80",
      style: { y: cloudsY, x: cloudsX },
      content: (
        <Image
          src="/landing/novo-hero-clouds-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "mountains",
      className: "inset-0 -z-20 overflow-hidden",
      style: { y: mountainsY },
      content: (
        <Image
          src="/landing/novo-hero-mountains-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "pines",
      className: "inset-0 -z-10 overflow-hidden opacity-80",
      style: { y: pinesY },
      content: (
        <Image
          src="/landing/novo-hero-pines-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "ridge",
      className: "inset-0 -z-10 overflow-hidden",
      style: { y: ridgeY },
      content: (
        <Image
          src="/landing/novo-hero-ridge-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "woodland",
      className: "inset-0 z-0 overflow-hidden",
      style: { y: woodlandY, scale: woodlandScale },
      content: (
        <Image
          src="/landing/novo-hero-woodland-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "left",
      className: "inset-0 z-[1] overflow-hidden",
      style: { y: leftY, x: leftX },
      content: (
        <Image
          src="/landing/novo-hero-left-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "right",
      className: "inset-0 z-[2] overflow-hidden",
      style: { y: rightY, x: rightX },
      content: (
        <Image
          src="/landing/novo-hero-right-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
    {
      id: "leaf-left",
      className: "inset-0 z-[3] overflow-hidden",
      style: { y: leafLeftY, x: leafLeftX },
      content: (
        <Image
          src="/landing/novo-hero-leaf-left-v1.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
      ),
    },
  ];
  const headline = copy.hero.headline;
  const words = headline.split(" ");
  return (
    <div
      ref={pinRef}
      className={reduceMotion ? "" : "relative h-[166dvh] lg:h-[184dvh]"}
    >
      <section
        className={`relative isolate overflow-hidden px-6 sm:px-10 lg:px-16 ${reduceMotion ? "min-h-[calc(100dvh-68px)] pb-16 pt-12 lg:flex lg:items-center lg:py-16" : "sticky top-0 flex min-h-dvh items-start pb-6 pt-20 lg:items-center lg:py-16"}`}
        style={{ backgroundColor: "var(--landing-elevated)" }}
      >
        <LandingHeroParallax
          reduceMotion={reduceMotion}
          layers={sceneLayers}
          narrativeStyle={{ y: copyY }}
          narrative={
            <div className={`landing-hero-copy ${heroReady ? "is-ready" : ""}`}>
              <motion.p
                initial={false}
                className="landing-enter landing-enter-lead inline-flex items-center gap-2 rounded-full border border-[#ADEBC1]/[0.18] bg-[#ADEBC1]/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F] sm:text-[11px]"
              >
                <span className="landing-motion-layer size-1.5 rounded-full bg-[#ADEBC1]" />
                {copy.hero.eyebrow}
              </motion.p>
              <motion.h1
                initial={false}
                className="landing-enter-title landing-hero-title-mask mt-5 max-w-2xl text-[clamp(3.5rem,5.7vw,6.25rem)] font-medium leading-[0.9] tracking-[-0.075em]"
                style={HEADING_STYLE}
              >
                {words.map((word, index) => (
                  <HeroWord
                    key={`${word}-${index}`}
                    word={word}
                    index={index}
                    heroReady={heroReady}
                    isLast={index === words.length - 1}
                  />
                ))}
              </motion.h1>
              <motion.p
                initial={false}
                className="landing-enter landing-enter-body mt-7 max-w-lg text-lg leading-relaxed"
                style={MUTED_STYLE}
              >
                {copy.hero.body}
              </motion.p>
              <motion.div
                initial={false}
                className="landing-enter landing-enter-actions mt-9 flex flex-wrap items-center gap-4"
              >
                <LandingTransitionLink
                  href="/auth/signup?callbackUrl=%2Fonboarding"
                  className="group inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] shadow-[0_16px_50px_rgba(173,235,193,0.14)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]"
                >
                  {copy.hero.primary}
                  <ArrowRight className="ml-2 size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </LandingTransitionLink>
                <a
                  href="#sistema"
                  className="group inline-flex h-12 items-center gap-2 px-2 text-sm font-medium transition-colors hover:text-[#ADEBC1]"
                  style={MUTED_STYLE}
                >
                  {copy.hero.secondary}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </motion.div>
            </div>
          }
        />
        <HeroTwinCutout progress={progress} reduceMotion={reduceMotion} />
        <HeroSignalCards
          progress={progress}
          reduceMotion={reduceMotion}
          locale={locale}
        />
      </section>
    </div>
  );
}

function AssemblyNarrativeSection({
  scrollContainer,
  locale,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  locale: LandingLocale;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 90%", "end 18%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const copyY = useTransform(progress, [0, 1], [24, -14]);
  const copyOpacity = useTransform(progress, [0, 0.24, 1], [0.44, 1, 1]);
  const copy = ASSEMBLY_SECTION_COPY[locale];

  return (
    <section
      ref={sectionRef}
      data-narrative-stage="assembly"
      className="relative overflow-hidden border-b px-6 py-20 sm:px-10 lg:px-16 lg:py-28"
      style={{
        backgroundColor: "var(--landing-elevated)",
        borderColor: "var(--landing-line)",
      }}
    >
      <div className="pointer-events-none absolute left-[18%] top-0 size-[28rem] rounded-full bg-[#ADEBC1]/[0.07] blur-[140px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
        <motion.div
          style={reduceMotion ? undefined : { y: copyY, opacity: copyOpacity }}
          className="relative z-10 max-w-xl"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F]">
            {copy.eyebrow}
          </p>
          <h2
            className="mt-6 text-[clamp(2.9rem,5.2vw,5.6rem)] font-medium leading-[0.92] tracking-[-0.07em]"
            style={HEADING_STYLE}
          >
            {copy.title}
          </h2>
          <p
            className="mt-7 max-w-lg text-lg leading-relaxed"
            style={MUTED_STYLE}
          >
            {copy.body}
          </p>
          <ol className="mt-9 grid gap-2.5 lg:hidden">
            {copy.mobile.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-3 border-t py-3 text-sm"
                style={{
                  borderColor: "var(--landing-line)",
                  color: "var(--landing-muted)",
                }}
              >
                <span className="text-[10px] font-medium tracking-[0.16em] text-[#71D88F]">
                  0{index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </motion.div>

        <div
          className="relative hidden min-h-[34rem] overflow-hidden rounded-[2rem] border lg:block"
          style={{
            borderColor: "var(--landing-line)",
            backgroundColor: "var(--landing-card)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_48%,rgba(173,235,193,0.13),transparent_34%),linear-gradient(135deg,rgba(247,242,233,0.3),transparent_58%)]" />
          <div className="absolute inset-[8%] rounded-full border border-dashed border-[#31563F]/[0.12]" />
          <HeroTwinCutout
            placement="assembly"
            progress={progress}
            reduceMotion={reduceMotion}
          />
          <AssemblyNarrative
            locale={locale}
            progress={progress}
            reduceMotion={reduceMotion}
          />
        </div>
      </div>
    </section>
  );
}

function ContextRail({
  copy,
  scrollContainer,
}: {
  copy: LandingCopy;
  scrollContainer: RefObject<HTMLDivElement | null>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 94%", "end 32%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const traceScale = useTransform(progress, [0.08, 0.76], [0, 1]);
  const traceOpacity = useTransform(progress, [0.06, 0.22, 1], [0, 0.72, 0.28]);

  return (
    <section
      ref={sectionRef}
      data-narrative-stage="sources"
      className="relative overflow-hidden border-b px-6 py-7 transition-colors duration-700 sm:px-10 lg:px-16"
      style={{
        backgroundColor: "var(--landing-elevated)",
        borderColor: "var(--landing-line)",
      }}
    >
      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-0.15rem] left-[15%] hidden h-px w-[72%] origin-left bg-[linear-gradient(90deg,transparent,rgba(173,235,193,.8),rgba(220,207,159,.5),transparent)] lg:block"
          style={
            reduceMotion
              ? { scaleX: 1, opacity: 0.26 }
              : { scaleX: traceScale, opacity: traceOpacity }
          }
        />
        <p
          className="max-w-[12rem] text-[10px] font-medium uppercase tracking-[0.17em]"
          style={SUBTLE_STYLE}
        >
          {copy.rail.label}
        </p>
        <div className="grid w-full grid-cols-2 gap-2 sm:max-w-3xl sm:grid-cols-4">
          {copy.rail.items.map(([label, detail], index) => (
            <motion.div
              key={label}
              initial={reduceMotion ? false : { opacity: 0.52, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.48, delay: index * 0.07, ease: PREMIUM_EASE }
              }
              className="group relative rounded-[1rem] border px-3 py-2.5 transition-[background-color,border-color,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5"
              style={{
                borderColor: "var(--landing-line)",
                backgroundColor: "var(--landing-card)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={MUTED_STYLE}>
                  {label}
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] tabular-nums text-[#ADEBC1]/60">
                  <span className="size-1 rounded-full bg-[#ADEBC1]/80" />0
                  {index + 1}
                </span>
              </div>
              <p className="mt-1 text-[10px]" style={SUBTLE_STYLE}>
                {detail}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ThesisBridge({
  copy,
  locale,
  scrollContainer,
}: {
  copy: LandingCopy;
  locale: LandingLocale;
  scrollContainer: RefObject<HTMLDivElement | null>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 88%", "end 24%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const threadScale = useTransform(progress, [0.04, 0.7], [0, 1]);
  const threadOpacity = useTransform(progress, [0.08, 0.22, 1], [0, 0.7, 0.28]);
  const chapterY = useTransform(progress, [0, 1], [28, -10]);
  const stages =
    locale === "en"
      ? [
          ["Intent", "What matters"],
          ["Evidence", "What happened"],
          ["Outcome", "What changes"],
        ]
      : [
          ["Intencion", "Lo que importa"],
          ["Evidencia", "Lo que paso"],
          ["Resultado", "Lo que cambia"],
        ];

  return (
    <section
      ref={sectionRef}
      data-narrative-stage="continuity"
      className="relative overflow-hidden border-y px-6 py-20 transition-colors duration-700 sm:px-10 lg:px-16 lg:py-28"
      style={{
        backgroundColor: "var(--landing-elevated)",
        borderColor: "var(--landing-line)",
      }}
    >
      <div className="pointer-events-none absolute -left-32 top-[22%] size-[30rem] rounded-full bg-[#DCCF9F]/[0.045] blur-[150px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.56fr_1fr] lg:items-end lg:gap-24">
        <motion.p
          style={reduceMotion ? undefined : { y: chapterY }}
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F]"
        >
          {copy.thesis.eyebrow}
        </motion.p>
        <div className="relative">
          <motion.div style={reduceMotion ? undefined : { y: chapterY }}>
            <h2
              className="max-w-4xl text-[clamp(2.7rem,5.2vw,5.7rem)] font-medium leading-[0.94] tracking-[-0.068em]"
              style={HEADING_STYLE}
            >
              {copy.thesis.title}
            </h2>
            <p
              className="mt-7 max-w-2xl text-lg leading-relaxed"
              style={MUTED_STYLE}
            >
              {copy.thesis.body}
            </p>
          </motion.div>
          <div
            aria-hidden="true"
            className="relative mt-10 hidden max-w-xl lg:block"
          >
            <motion.div
              className="absolute left-2 top-[1.15rem] h-px w-[calc(100%-1rem)] origin-left bg-[linear-gradient(90deg,rgba(173,235,193,.82),rgba(220,207,159,.55),transparent)]"
              style={
                reduceMotion
                  ? { scaleX: 1, opacity: 0.35 }
                  : { scaleX: threadScale, opacity: threadOpacity }
              }
            />
            <div className="grid grid-cols-3 gap-5">
              {stages.map(([label, detail], index) => (
                <motion.div
                  key={label}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.65 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.5,
                          delay: 0.08 + index * 0.09,
                          ease: PREMIUM_EASE,
                        }
                  }
                >
                  <span className="relative z-10 block size-2.5 rounded-full border border-[#31563F]/30 bg-[#F5EEDC] shadow-[0_4px_12px_rgba(18,49,31,.12)]" />
                  <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-[#71D88F]">
                    {label}
                  </p>
                  <p className="mt-1 text-xs" style={SUBTLE_STYLE}>
                    {detail}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialPrinciples({
  copy,
  scrollContainer,
}: {
  copy: LandingCopy;
  scrollContainer: RefObject<HTMLDivElement | null>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-7%", "8%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.17]);
  return (
    <section
      ref={sectionRef}
      data-narrative-stage="control"
      className="px-6 py-24 sm:px-10 lg:px-16 lg:py-32"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0.62, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.72, ease: PREMIUM_EASE }
          }
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#71D88F]">
            {copy.editorialTwo.eyebrow}
          </p>
          <h2
            className="mt-6 max-w-2xl text-[clamp(2.8rem,5.2vw,5.6rem)] font-medium leading-[0.94] tracking-[-0.068em]"
            style={HEADING_STYLE}
          >
            {copy.editorialTwo.title}
          </h2>
          <p
            className="mt-6 max-w-lg text-lg leading-relaxed"
            style={MUTED_STYLE}
          >
            {copy.editorialTwo.body}
          </p>
          <div
            className="relative mt-10 aspect-[1.35/1] overflow-hidden rounded-[1.55rem] border"
            style={{ borderColor: "var(--landing-line)" }}
          >
            <motion.div
              className="absolute inset-x-0 -top-[10%] h-[120%]"
              style={
                reduceMotion ? undefined : { y: imageY, scale: imageScale }
              }
            >
              <Image
                src="/landing/novo-editorial-memory.webp"
                alt={copy.editorialTwo.imageAlt}
                fill
                sizes="(max-width: 1024px) 92vw, 45vw"
                className="object-cover"
              />
            </motion.div>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,13,9,0)_36%,rgba(5,13,9,.28))]" />
          </div>
        </motion.div>
        <div
          className="self-end divide-y border-y"
          style={{ borderColor: "var(--landing-line)" }}
        >
          {copy.editorialTwo.principles.map(([title, body], index) => (
            <motion.div
              key={title}
              initial={reduceMotion ? false : { opacity: 0.62, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.56, delay: index * 0.055, ease: PREMIUM_EASE }
              }
              className="py-7 sm:py-8"
            >
              <h3
                className="text-xl font-medium tracking-[-0.035em]"
                style={HEADING_STYLE}
              >
                {title}
              </h3>
              <p
                className="mt-3 max-w-md text-sm leading-relaxed sm:text-base"
                style={MUTED_STYLE}
              >
                {body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingFinale({
  scrollContainer,
  copy,
}: {
  scrollContainer: RefObject<HTMLDivElement | null>;
  copy: LandingCopy;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    container: scrollContainer,
    offset: ["start 88%", "end 24%"],
  });
  const progress = useSpring(scrollYProgress, PIN_SPRING);
  const copyY = useTransform(progress, [0, 0.3, 1], [18, 0, -5]);
  const copyOpacity = useTransform(progress, [0, 0.22, 1], [0.62, 1, 1]);

  return (
    <section
      ref={sectionRef}
      data-narrative-stage="closure"
      className="px-6 pb-24 pt-8 sm:px-10 lg:px-16 lg:pb-32"
    >
      <motion.div
        initial={false}
        className="relative mx-auto min-h-[29rem] overflow-hidden rounded-[2rem] border px-7 py-16 sm:px-12 sm:py-20 lg:min-h-[36rem] lg:max-w-7xl lg:px-16"
        style={{
          borderColor: "rgba(173,235,193,.22)",
          backgroundColor: "var(--landing-emphasis)",
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[#ADEBC1]/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute right-[11%] top-[16%] hidden size-[22rem] rounded-full border border-[#ADEBC1]/[0.1] lg:block" />
        <ClosingTwinPath progress={progress} reduceMotion={reduceMotion} />
        <HeroTwinCutout
          placement="final"
          progress={progress}
          reduceMotion={reduceMotion}
        />
        <motion.div
          className="relative z-10 max-w-3xl lg:max-w-[54%]"
          style={reduceMotion ? undefined : { y: copyY, opacity: copyOpacity }}
        >
          <h2
            className="text-[clamp(3rem,6vw,6.4rem)] font-medium leading-[0.9] tracking-[-0.075em]"
            style={HEADING_STYLE}
          >
            {copy.final.title}
          </h2>
          <p
            className="mt-7 max-w-xl text-lg leading-relaxed"
            style={MUTED_STYLE}
          >
            {copy.final.body}
          </p>
          <LandingTransitionLink
            href="/auth/signup?callbackUrl=%2Fonboarding"
            className="relative z-10 mt-9 inline-flex h-12 items-center rounded-full bg-[#ADEBC1] px-6 text-sm font-semibold text-[#06100B] shadow-[0_12px_36px_rgba(173,235,193,.14)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#CBF5D8] active:scale-[0.98]"
          >
            {copy.final.action}
            <ArrowRight className="ml-2 size-4" />
          </LandingTransitionLink>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Pricing({ copy }: { copy: LandingCopy }) {
  return (
    <section
      id="precios"
      className="px-6 pb-16 pt-6 sm:px-10 lg:px-16 lg:pb-24"
    >
      <div
        className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border"
        style={{
          borderColor: "var(--landing-line)",
          backgroundColor: "var(--landing-card)",
        }}
      >
        <div className="grid lg:grid-cols-[.78fr_1.22fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-sm font-medium" style={MUTED_STYLE}>
              {copy.prices.free}
            </p>
            <div className="mt-6">
              <span
                className="text-5xl font-medium tracking-[-0.06em]"
                style={HEADING_STYLE}
              >
                $0
              </span>
              <span className="ml-2 text-sm" style={SUBTLE_STYLE}>
                {copy.prices.freePeriod}
              </span>
            </div>
            <p
              className="mt-5 max-w-sm text-sm leading-relaxed"
              style={MUTED_STYLE}
            >
              {copy.prices.freeBody}
            </p>
            <LandingTransitionLink
              href="/auth/signup?callbackUrl=%2Fonboarding"
              className="mt-9 inline-flex h-11 items-center rounded-full border px-5 text-sm font-semibold transition hover:bg-[#ADEBC1]/[0.1] active:scale-[0.98]"
              style={{
                borderColor: "var(--landing-line)",
                color: "var(--landing-heading)",
              }}
            >
              {copy.prices.freeAction}
            </LandingTransitionLink>
          </div>
          <div
            className="relative border-t p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12"
            style={{
              borderColor: "var(--landing-line)",
              backgroundColor: "var(--landing-emphasis)",
            }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[#ADEBC1]/[0.08] blur-3xl" />
            <div className="relative">
              <p className="text-sm font-medium text-[#71D88F]">
                {copy.prices.pro}
              </p>
              <div className="mt-6">
                <span
                  className="text-5xl font-medium tracking-[-0.06em]"
                  style={HEADING_STYLE}
                >
                  $9.99
                </span>
                <span className="ml-2 text-sm" style={MUTED_STYLE}>
                  {copy.prices.period}
                </span>
              </div>
              <p
                className="mt-5 max-w-lg text-sm leading-relaxed"
                style={MUTED_STYLE}
              >
                {copy.prices.proBody}
              </p>
              <div
                className="mt-7 grid gap-3 text-sm sm:grid-cols-2"
                style={MUTED_STYLE}
              >
                {copy.prices.proFeatures.map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#ADEBC1]" />
                    {item}
                  </div>
                ))}
              </div>
              <LandingTransitionLink
                href="/auth/signup?intent=pro&callbackUrl=%2Fsettings%3Ftab%3Dbilling%26source%3Dlanding-intent"
                className="mt-9 inline-flex h-11 items-center rounded-full bg-[#ADEBC1] px-5 text-sm font-semibold text-[#06100B] transition hover:bg-[#CBF5D8] active:scale-[0.98]"
              >
                {copy.prices.proAction}
                <ArrowRight className="ml-2 size-4" />
              </LandingTransitionLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPageContent({ heroReady }: { heroReady: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useLandingReducedMotion();
  const [locale, setLocale] = useState<LandingLocale>("en");
  const [theme, setTheme] = useState<LandingTheme>("light");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("novo-landing-locale");
    const savedTheme = window.localStorage.getItem("novo-landing-theme");
    if (savedLocale === "en" || savedLocale === "es") setLocale(savedLocale);
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("novo-landing-locale", locale);
  }, [locale]);
  useEffect(() => {
    window.localStorage.setItem("novo-landing-theme", theme);
  }, [theme]);

  const copy = LANDING_COPY[locale];
  const palette =
    theme === "dark"
      ? {
          bg: "#06100B",
          elevated: "#09130E",
          card: "rgba(12,24,17,.86)",
          emphasis: "#101D15",
          heading: "#F4F0E8",
          muted: "rgba(244,240,232,.62)",
          subtle: "rgba(244,240,232,.4)",
          line: "rgba(244,240,232,.1)",
          nav: "rgba(7,16,12,.78)",
          control: "rgba(244,240,232,.045)",
          inverse: "#06100B",
          navShadow: "0 14px 50px rgba(0,0,0,.18)",
        }
      : {
          bg: "#F2EEE4",
          elevated: "#EAE5D8",
          card: "rgba(250,247,239,.82)",
          emphasis: "#E0E8DD",
          heading: "#182017",
          muted: "rgba(24,32,23,.68)",
          subtle: "rgba(24,32,23,.48)",
          line: "rgba(24,32,23,.14)",
          nav: "rgba(250,247,239,.78)",
          control: "rgba(24,32,23,.055)",
          inverse: "#F8F4EA",
          navShadow: "0 14px 50px rgba(45,41,31,.10)",
        };
  const rootStyle = {
    "--primary": "#ADEBC1",
    "--background": palette.bg,
    "--foreground": palette.heading,
    "--landing-bg": palette.bg,
    "--landing-elevated": palette.elevated,
    "--landing-card": palette.card,
    "--landing-emphasis": palette.emphasis,
    "--landing-heading": palette.heading,
    "--landing-muted": palette.muted,
    "--landing-subtle": palette.subtle,
    "--landing-line": palette.line,
    "--landing-nav": palette.nav,
    "--landing-control": palette.control,
    "--landing-inverse": palette.inverse,
    "--landing-nav-shadow": palette.navShadow,
    fontFamily: "'Outfit', 'Inter', sans-serif",
  } as CSSProperties;

  return (
    <div
      ref={scrollRef}
      lang={locale}
      data-landing-theme={theme}
      className="landing-ambient h-dvh overflow-x-hidden overflow-y-auto [overflow-x:clip] [scrollbar-width:none]"
      style={rootStyle}
    >
      <SmoothScrollProvider scrollRef={scrollRef}>
        <div
          className="min-h-full transition-colors duration-700"
          style={{
            backgroundColor: "var(--landing-bg)",
            color: "var(--landing-heading)",
          }}
        >
          <style jsx global>{`
            @keyframes novo-breathe {
              0%,
              100% {
                opacity: 0.54;
                transform: scale(0.92);
              }
              50% {
                opacity: 1;
                transform: scale(1.08);
              }
            }
            @keyframes novo-enter {
              from {
                opacity: 0;
                filter: blur(5px);
                transform: translate3d(0, 22px, 0);
              }
              70% {
                opacity: 1;
                filter: blur(0);
              }
              to {
                opacity: 1;
                filter: blur(0);
                transform: translate3d(0, 0, 0);
              }
            }
            .landing-motion-layer {
              animation: novo-breathe 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }
            .landing-enter {
              opacity: 0;
              transform: translate3d(0, 22px, 0);
              will-change: transform, opacity, filter;
            }
            .landing-hero-copy.is-ready .landing-enter {
              animation: novo-enter 0.78s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            .landing-enter-title {
              isolation: isolate;
              overflow: hidden;
            }
            /* The hero keeps its editorial paper mask. The live product field
               is reserved for the Context doorway later in the narrative. */
            @supports ((-webkit-background-clip: text) or (background-clip: text)) {
              .landing-hero-title-mask {
                background-image:
                  linear-gradient(
                    112deg,
                    rgba(7, 28, 17, 0.52) 4%,
                    rgba(51, 118, 68, 0.24) 44%,
                    rgba(12, 42, 25, 0.48) 100%
                  ),
                  url("/landing/novo-hero-title-texture-v2.webp");
                background-position: center, 52% 52%;
                background-repeat: no-repeat;
                background-size: 100% 100%, 160% auto;
                background-blend-mode: multiply;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              [data-landing-theme="dark"] .landing-hero-title-mask {
                -webkit-text-fill-color: transparent;
              }
            }
            .landing-enter-body {
              animation-delay: 0.18s;
            }
            .landing-enter-actions {
              animation-delay: 0.29s;
            }
            [data-landing-theme="light"].landing-ambient::before {
              background:
                radial-gradient(
                  ellipse 58% 72% at 16% 8%,
                  rgba(120, 181, 132, 0.17),
                  transparent 70%
                ),
                radial-gradient(
                  ellipse 50% 64% at 88% 12%,
                  rgba(203, 185, 124, 0.14),
                  transparent 72%
                ),
                linear-gradient(135deg, #f7f2e9 4%, #ece8db 52%, #f4f0e7 100%);
              filter: blur(12px) saturate(92%);
            }
            [data-landing-theme="light"].landing-ambient::after {
              opacity: 0.05;
              mix-blend-mode: multiply;
            }
            @media (prefers-reduced-motion: reduce) and (max-width: 1023px) {
              .landing-motion-layer,
              .landing-enter {
                animation: none !important;
                opacity: 1 !important;
                filter: none !important;
                transform: none !important;
              }
            }
          `}</style>
          <ScrollProgress scrollRef={scrollRef} />
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-[#ADEBC1] focus:px-4 focus:py-2 focus:text-sm focus:text-[#06100B]"
          >
            {locale === "en" ? "Skip to content" : "Saltar al contenido"}
          </a>
          <LandingNav
            copy={copy}
            locale={locale}
            setLocale={setLocale}
            theme={theme}
            setTheme={setTheme}
          />
          <main id="contenido">
            <HeroSection
              scrollContainer={scrollRef}
              copy={copy}
              locale={locale}
              heroReady={heroReady}
            />
            <AssemblyNarrativeSection
              scrollContainer={scrollRef}
              locale={locale}
            />
            <ContextRail copy={copy} scrollContainer={scrollRef} />
            <ThesisBridge
              copy={copy}
              locale={locale}
              scrollContainer={scrollRef}
            />
            <ContextFlow scrollContainer={scrollRef} copy={copy} />
            <EditorialMoment scrollContainer={scrollRef} copy={copy} />
            <ContextSystemJourney
              scrollContainer={scrollRef}
              copy={copy}
              locale={locale}
            />
            <ProductSection scrollContainer={scrollRef} copy={copy} />
            <EditorialPrinciples copy={copy} scrollContainer={scrollRef} />
            <Pricing copy={copy} />
            <LandingFinale scrollContainer={scrollRef} copy={copy} />
          </main>
          <footer
            className="border-t px-6 py-8 sm:px-10 lg:px-16"
            style={{ borderColor: "var(--landing-line)" }}
          >
            <div
              className="mx-auto flex max-w-7xl flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between"
              style={SUBTLE_STYLE}
            >
              <span
                className="font-semibold uppercase tracking-[0.2em]"
                style={MUTED_STYLE}
              >
                Novo
              </span>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <LandingTransitionLink
                  href="/app"
                  className="hover:text-[#71D88F]"
                >
                  {copy.footer.signIn}
                </LandingTransitionLink>
                <LandingTransitionLink
                  href="/auth/signup?callbackUrl=%2Fonboarding"
                  className="hover:text-[#71D88F]"
                >
                  {copy.footer.create}
                </LandingTransitionLink>
                <a href="#sistema" className="hover:text-[#71D88F]">
                  {copy.footer.how}
                </a>
                <a href="#producto" className="hover:text-[#71D88F]">
                  {copy.footer.product}
                </a>
                <a href="#precios" className="hover:text-[#71D88F]">
                  {copy.footer.plans}
                </a>
                <Link href="/terms" className="hover:text-[#71D88F]">
                  {copy.footer.terms}
                </Link>
                <Link href="/privacy" className="hover:text-[#71D88F]">
                  {copy.footer.privacy}
                </Link>
                <Link href="/refunds" className="hover:text-[#72D88F]">
                  {copy.footer.refunds}
                </Link>
              </div>
              <span>© {new Date().getFullYear()} Novo</span>
            </div>
          </footer>
        </div>
      </SmoothScrollProvider>
    </div>
  );
}

export default function LandingPage() {
  const [heroReady, setHeroReady] = useState(false);

  return (
    <PageTransitionProvider>
      <LandingImageLoader onComplete={() => setHeroReady(true)} />
      <LandingPageContent heroReady={heroReady} />
    </PageTransitionProvider>
  );
}
