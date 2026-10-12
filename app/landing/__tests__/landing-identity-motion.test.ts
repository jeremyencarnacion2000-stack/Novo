import fs from "node:fs";
import path from "node:path";

const landingSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "app", "landing", "page.tsx"),
    "utf8",
  );
const landingLoadingSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "app", "landing", "loading.tsx"),
    "utf8",
  );
const landingImageLoaderSource = () =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "landing",
      "landing-image-loader.tsx",
    ),
    "utf8",
  );
const parallaxSource = () =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "landing",
      "multilayer-parallax.tsx",
    ),
    "utf8",
  );
const twinCutoutSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "components", "landing", "hero-twin-cutout.tsx"),
    "utf8",
  );
const heroSignalCardsSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "components", "landing", "hero-signal-cards.tsx"),
    "utf8",
  );
const closingTwinPathSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "components", "landing", "closing-twin-path.tsx"),
    "utf8",
  );
const editorialThreadSource = () =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "landing",
      "editorial-scroll-thread.tsx",
    ),
    "utf8",
  );
const assemblyNarrativeSource = () =>
  fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "landing",
      "hero-assembly-narrative.tsx",
    ),
    "utf8",
  );
const deviceMockupSource = () =>
  fs.readFileSync(
    path.join(process.cwd(), "components", "landing", "device-mockups.tsx"),
    "utf8",
  );
const globalStylesSource = () =>
  fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
const productCaptureAsset = () =>
  path.join(
    process.cwd(),
    "docs",
    "release",
    "evidence",
    "current-cognitive-product-desktop.png",
  );
const heroAsset = (name: string) =>
  path.join(process.cwd(), "public", "landing", name);

describe("landing identity and motion", () => {
  it("uses the Novo application mark in the top bar", () => {
    expect(landingSource()).toContain('src="/icon.svg"');
  });

  it("uses a reduced-motion-safe authored hero reveal", () => {
    const source = landingSource();

    expect(source).toContain('clipPath: "inset(0 0 0 0 round 1.75rem)"');
    expect(source).toContain("useReducedMotion()");
    expect(source).toMatch(/transition=\{\s*reduceMotion \? \{ duration: 0 \}/);
    expect(source).toContain("initial={false}");
  });

  it("keeps the authored landing scene in motion on desktop while preserving compact fallbacks", () => {
    const source = landingSource();

    expect(source).toContain("function useLandingReducedMotion()");
    expect(source).toContain('window.matchMedia("(min-width: 1024px)")');
    expect(source).toContain("return isDesktop ? false : systemReducedMotion");
    expect(source).toContain(
      "@media (prefers-reduced-motion: reduce) and (max-width: 1023px)",
    );
    expect(globalStylesSource()).toContain(
      "@media (prefers-reduced-motion: reduce) and (max-width: 1023px) { .landing-ambient::before",
    );
  });

  it("routes every auth conversion CTA through the landing transition", () => {
    const source = landingSource();

    expect(source).toContain("function LandingTransitionLink");
    expect(
      source.match(/<LandingTransitionLink/g)?.length,
    ).toBeGreaterThanOrEqual(7);
    expect(source).not.toMatch(/<Link href="\/auth\/(?:signup|signin)/);
  });

  it("keeps a branded fallback visible while the landing hydrates", () => {
    expect(landingLoadingSource()).toContain("landing-ambient");
  });

  it("uses a GSAP four-column image sequence before the landing is revealed", () => {
    const source = landingImageLoaderSource();

    expect(source).toContain("const LOADER_COLUMNS");
    expect(source).toContain("gsap.timeline");
    expect(source).toContain("duration: SWEEP_DURATION");
    expect(source).toContain("const IMAGE_STAGGER = 0.42");
    expect(source).toContain("stagger: { each: IMAGE_STAGGER, from: 'start' }");
    expect(source).toContain("willChange: 'transform'");
    expect(source).toContain("height: '0%'");
    expect(source).toContain("stagger: { each: CURTAIN_STAGGER, from: 'end' }");
    expect(source).toContain(".set(root, { display: 'none', pointerEvents: 'none' })");
    expect(source).not.toContain(".to(root, { autoAlpha: 0");
    expect(source).not.toContain("product-ai.png");
    expect(source).not.toContain("context-field.webp");
    for (const asset of [
      'signal',
      'context',
      'memory',
      'direction',
      'envelope',
      'signal-cloud',
      'clock',
      'notebook',
      'botanical-brain',
      'constellation',
      'memory-vessel',
      'calendar-flag',
      'brain-path',
      'moon-mountains',
      'compass',
      'thread-cards',
    ]) {
      const filename = `novo-loader-${asset}-v1.webp`;
      expect(source).toContain(`/landing/loader-optimized/${filename}`);
      expect(fs.existsSync(path.join(process.cwd(), "public", "landing", "loader-optimized", filename))).toBe(true);
    }
  });

  it("grounds the visual story in current product evidence instead of generated artwork", () => {
    const source = landingSource();

    expect(source).toContain("ProductWindow");
    expect(source).toContain("ContextMask");
    expect(source).toContain('data-testid="context-shared-field"');
    expect(source).toContain("function ContextSystemJourney");
    expect(source.match(/\/landing\/novo-context-portal-v1\.webp/g)).toHaveLength(1);
    expect(source).toContain("current-cognitive-product-desktop.png");
    expect(source).not.toContain("/landing/product-ai.png");
    expect(source).not.toContain("/landing/cognitive-sculpture.png");
    expect(source).not.toContain("/landing/context-field.webp");
    expect(source).not.toContain("/landing/hero-atmosphere.png");
    expect(fs.existsSync(productCaptureAsset())).toBe(true);
    expect(fs.existsSync(heroAsset("novo-context-portal-v1.webp"))).toBe(true);
  });

  it("opens with a navigable Twin field", () => {
    const source = landingSource();

    expect(source).toContain("function LandingTwinField");
    expect(source).toContain('data-testid="landing-twin-field"');
    expect(source).toContain('aria-label="Explorar el contexto del Twin"');
    expect(source).toContain("aria-pressed={selected}");
  });

  it("clips decorative horizontal motion without creating a sideways mobile page", () => {
    expect(landingSource()).toContain(
      "landing-ambient h-dvh overflow-x-hidden overflow-y-auto",
    );
  });

  it("uses scroll-linked cognitive storytelling instead of repeating a flat reveal", () => {
    const source = landingSource();

    expect(source).toContain("function CognitiveSequence");
    expect(source).toContain('data-testid="cognitive-sequence"');
    expect(source).toContain("useMotionTemplate");
    expect(source).toContain('whileInView="visible"');
    expect(source).toContain("prefers-reduced-motion");
  });

  it("hands attention between post-hero chapters with one restrained editorial route", () => {
    const source = landingSource();
    const thread = editorialThreadSource();

    expect(source.match(/<EditorialScrollThread/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('variant="flow"');
    expect(source).toContain('variant="sequence"');
    expect(source).toContain('variant="product"');
    expect(thread).toContain("useTransform(progress");
    expect(thread).toContain('strokeDasharray="1.1 1.8"');
    expect(thread).toContain("reduceMotion");
  });

  it("carries the same narrative through sources, continuity, and user control", () => {
    const source = landingSource();

    expect(source).toContain('data-narrative-stage="sources"');
    expect(source).toContain('data-narrative-stage="continuity"');
    expect(source).toContain('data-narrative-stage="control"');
    expect(source).toContain("function ThesisBridge");
    expect(source).toContain("traceScale");
    expect(source).toContain("threadScale");
    expect(source).toContain("scrollContainer={scrollRef}");
  });

  it("keeps the hero readable before hydration while its authored entrance runs", () => {
    const source = landingSource();

    expect(source).toContain("@keyframes novo-enter");
    expect(source).toContain("landing-hero-copy ${heroReady ? \"is-ready\" : \"\"}");
    expect(source).toContain("landing-hero-copy.is-ready .landing-enter");
    expect(source).toContain("onComplete={() => setHeroReady(true)}");
    expect(source).toContain("landing-enter landing-enter-lead");
    expect(source).toContain("landing-enter-title landing-hero-title-mask");
    expect(source).toContain("landing-hero-title-mask");
    expect(source).toContain('url("/landing/novo-hero-title-texture-v2.webp")');
    expect(fs.existsSync(heroAsset("novo-hero-title-texture-v2.webp"))).toBe(true);
    expect(source).toContain("-webkit-background-clip: text");
    expect(source).toContain("landing-enter landing-enter-actions");
    expect(source).not.toContain('const filter = useMotionTemplate`blur(${blur}px)`;');
  });

  it("shows current Novo captures in dedicated desktop and phone mockups", () => {
    const source = landingSource();
    const mockups = deviceMockupSource();

    expect(source).toContain("function ProductSection");
    expect(source).toContain("richOpacity");
    expect(source).toContain("progress: MotionValue<number>");
    expect(source).toContain("DesktopDeviceMockup");
    expect(source).toContain("PhoneDeviceMockup");
    expect(source).toContain("currentMobileCapture");
    expect(mockups).toContain("export function DesktopDeviceMockup");
    expect(mockups).toContain("export function PhoneDeviceMockup");
  });

  it("pins the hero and reveals the headline word-by-word as the user scrolls", () => {
    const source = landingSource();

    expect(source).toContain("function HeroSection");
    expect(source).toContain("const HERO_HEADLINE");
    expect(source).toContain("function HeroWord");
  });

  it("uses independently cut composited planes and keeps a reduced-motion fallback", () => {
    const source = landingSource();
    const parallax = parallaxSource();

    expect(source).toContain("LandingHeroParallax");
    expect(source).toContain("const sceneLayers: HeroSceneLayer[] = [");
    expect(source).toContain("function useSceneScrollProgress");
    expect(source).toContain(
      'container.addEventListener("scroll", scheduleUpdate',
    );
    expect(source).toContain(
      'window.addEventListener("scroll", scheduleUpdate',
    );
    expect(source).toContain("requestAnimationFrame(updateWhileVisible)");
    expect(source).toContain("const progress = scrollYProgress");
    expect(source).toContain("fixed inset-x-0 top-0 z-50");
    expect(source).toContain("h-[166dvh] lg:h-[184dvh]");
    expect(parallax).toContain("layers.map((layer)");
    expect(parallax).toContain("landing-hero-parallax-${layer.id}");
    expect(parallax).toContain("landing-hero-parallax-narrative");
    for (const layer of [
      "atmosphere",
      "sun",
      "clouds",
      "mountains",
      "pines",
      "ridge",
      "woodland",
      "left",
      "right",
      "leaf-left",
    ]) {
      expect(source).toContain(`id: "${layer}"`);
    }
    for (const layer of [
      "clouds",
      "mountains",
      "pines",
      "ridge",
      "woodland",
      "left",
      "right",
      "leaf-left",
    ]) {
      const asset = `novo-hero-${layer}-v1.webp`;
      expect(source).toContain(`/landing/${asset}`);
      expect(fs.existsSync(heroAsset(asset))).toBe(true);
    }
    expect(source).toContain("/landing/novo-hero-atmosphere-v1.webp");
    expect(fs.existsSync(heroAsset("novo-hero-atmosphere-v1.webp"))).toBe(true);
    expect(
      source.match(/object-cover object-center/g)?.length,
    ).toBeGreaterThanOrEqual(9);
    expect(source).toContain(
      'const atmosphereY = useTransform(progress, [0, 1], ["-2%", "-8%"])',
    );
    expect(source).toContain(
      'const woodlandY = useTransform(progress, [0, 1], ["12%", "-56%"])',
    );
    expect(source).toContain(
      'const leafLeftY = useTransform(progress, [0, 1], ["18%", "-88%"])',
    );
    expect(source).not.toContain('id: "leaf-right"');
    expect(source).not.toContain("foreground={<LandingTwinField");
  });

  it("uses a reduced-motion-safe cognitive cutout after the hero promise", () => {
    const source = landingSource();
    const cutout = twinCutoutSource();

    expect(source).toContain("function AssemblyNarrativeSection");
    expect(source).toContain('placement="assembly"');
    expect(source).toContain("HeroTwinCutout");
    expect(cutout).toContain('data-testid="landing-hero-twin-cutout"');
    expect(cutout).toContain("reduceMotion ? undefined");
    expect(cutout).toContain('const isAssembly = placement === "assembly"');
    expect(cutout).toMatch(/isAssembly\s*\?\s*\["13%", "2%", "-3%"\]/);
    expect(cutout).toMatch(/isAssembly\s*\?\s*\["29%", "4%", "-9%"\]/);
    expect(cutout).toContain("repeat: Infinity");
    expect(cutout).toContain("/landing/novo-hero-twin-cutout-v1.webp");
    expect(fs.existsSync(heroAsset("novo-hero-twin-cutout-v1.webp"))).toBe(true);
  });

  it("restores the hero's scroll-linked signal cards around the Twin", () => {
    const source = landingSource();
    const cards = heroSignalCardsSource();

    expect(source).toContain("HeroSignalCards");
    expect(source).toContain("locale={locale}");
    expect(cards).toContain('data-testid="landing-hero-signal-cards"');
    expect(cards).toContain('"Signal", "A plan moved"');
    expect(cards).toContain('"Context", "The thread stayed"');
    expect(cards).toContain('"Direction", "A next move formed"');
    expect(cards).toContain('data-testid="landing-hero-signal-trails"');
    expect(cards).toContain("function HeroSignalTrail");
    expect(cards).toContain("strokeDasharray");
    expect(cards).toContain("bg-[#F5EEDC]/[0.91]");
    expect(cards).toContain("enterAt={0.1}");
    expect(cards).toContain("enterAt={0.25}");
    expect(cards).toContain("enterAt={0.4}");
    expect(cards).toContain("reduceMotion ? undefined");
  });

  it("returns the Twin at the close and grows a route toward the final action", () => {
    const source = landingSource();
    const path = closingTwinPathSource();
    const cutout = twinCutoutSource();

    expect(source).toContain("function LandingFinale");
    expect(source).toContain('data-narrative-stage="closure"');
    expect(source).toContain('placement="final"');
    expect(source).toContain("ClosingTwinPath");
    expect(source).toContain(
      "<LandingFinale scrollContainer={scrollRef} copy={copy} />",
    );
    expect(path).toContain('data-testid="landing-closing-twin-path"');
    expect(path).toContain("const pathLength = useTransform");
    expect(path).toContain("strokeDasharray");
    expect(cutout).toContain('placement?: "hero" | "assembly" | "final"');
  });

  it("moves concrete sources into phase two after the semantic hero scene", () => {
    const source = landingSource();
    const assembly = assemblyNarrativeSource();

    expect(source).toContain('data-narrative-stage="assembly"');
    expect(source).toContain("AssemblyNarrative");
    expect(assembly).toContain('data-testid="landing-assembly-narrative"');
    expect(assembly).toContain('"Tasks", "3 open"');
    expect(assembly).toContain('"Calendar", "2 blocks"');
    expect(assembly).toContain('"Rhythm", "High focus"');
    expect(assembly).toContain("connectionScale");
  });
});
