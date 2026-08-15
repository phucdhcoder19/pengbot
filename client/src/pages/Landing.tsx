import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";
import {
  AlertIcon,
  ChatIcon,
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  DocumentIcon,
  OverviewIcon,
  SendIcon,
} from "../components/ui/icons";

/**
 * Trang chủ công khai — theo ngôn ngữ của Attio: nền trắng, chữ đen, NÚT ĐEN
 * (không nút màu), gradient tím-lam rất nhạt sau mockup, banner đen trên cùng,
 * hiệu ứng motion fade-up khi cuộn. Jade chỉ còn ở logo và trong mockup sản phẩm.
 */
export function LandingPage() {
  const { user } = useAuth();
  const loggedIn = user !== null;

  // Chủ ý KHÔNG gate theo prefers-reduced-motion ở trang marketing này:
  // Windows tắt "Animation effects" là chuyện phổ biến ở máy văn phòng VN,
  // và toàn bộ hiệu ứng ở đây chỉ là fade/trôi nhẹ, không zoom không xoay.
  return (
    <div className="min-h-dvh bg-canvas">
      <AnnouncementBar />
      <SiteHeader loggedIn={loggedIn} />
      <main>
        <Hero loggedIn={loggedIn} />
        <LogoStrip />
        <HowItWorks />
        <Features />
        <ContextSection />
        <Integrations />
        <MetricsBand />
        <Testimonial />
        <Pricing />
        <FinalCta loggedIn={loggedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ───────────────────────── Chuyển động ───────────────────────── */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Fade-up khi cuộn tới — chạy một lần, kiểu Attio. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px 0px" }}
      transition={{ duration: 0.65, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────────── Banner + điều hướng ───────────────────────── */

function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative bg-text text-inverse">
      <div className="mx-auto flex h-10 max-w-[1120px] items-center justify-center px-12 text-[13px]">
        <a
          href="#features"
          className="group inline-flex items-center gap-1.5 font-medium"
        >
          New: match the widget to your brand colors
          <ChevronLeftIcon className="size-3.5 rotate-180 transition-transform duration-150 group-hover:translate-x-0.5" />
        </a>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute top-1/2 right-4 -translate-y-1/2 rounded p-1 opacity-70 transition-opacity duration-150 hover:opacity-100"
      >
        <CloseIcon className="size-3.5" />
      </button>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 items-center justify-center rounded-md bg-accent",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4 text-on-accent" fill="none">
        <path
          d="M6 5h7.2c2.6 0 4.4 1.7 4.4 4.1s-1.8 4.2-4.4 4.2H9.1V18H6V5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

/** Nút đen — ngôn ngữ CTA của Attio. Trong dark mode tự đảo thành nút sáng. */
const darkBtn =
  "inline-flex items-center justify-center rounded-lg bg-text font-medium text-inverse transition-all duration-150 hover:bg-text/85";
const lightBtn =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface font-medium text-text transition-colors duration-150 hover:bg-hover";

function SiteHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 rounded-md">
          <BrandMark />
          <span className="font-sans text-[19px] font-bold tracking-tight">
            Pengbot
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Home">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-soft transition-colors duration-150 hover:bg-hover hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link to="/app" className={cn(darkBtn, "h-9 px-4 text-sm")}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(
                  lightBtn,
                  "hidden h-9 border-transparent bg-transparent px-3 text-sm sm:inline-flex",
                )}
              >
                Sign in
              </Link>
              <Link to="/register" className={cn(darkBtn, "h-9 px-4 text-sm")}>
                Start for free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ loggedIn }: { loggedIn: boolean }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });

  /**
   * Cảnh GHIM kiểu Attio: section cao 240vh nhưng nội dung dính lại một màn
   * hình. Cuộn xuống → headline lùi lên và mờ dần, cửa sổ sản phẩm cùng ba
   * thẻ vệ tinh BAY TỪ DƯỚI LÊN vào vị trí, mỗi thẻ một tốc độ. Đây chính là
   * hiệu ứng "cuộn nhẹ là cả màn hình thành cảnh sản phẩm" của Attio.
   */
  const headY = useTransform(scrollYProgress, [0, 0.22], [0, -130]);
  const headOpacity = useTransform(scrollYProgress, [0.02, 0.16], [1, 0]);

  const winY = useTransform(scrollYProgress, [0, 0.72], [330, -30]);
  const winScale = useTransform(scrollYProgress, [0, 0.72], [0.95, 1]);
  const satAY = useTransform(scrollYProgress, [0.08, 0.8], [560, -30]);
  const satBY = useTransform(scrollYProgress, [0.14, 0.86], [660, 0]);
  const satCY = useTransform(scrollYProgress, [0.04, 0.76], [600, -60]);
  const washOpacity = useTransform(scrollYProgress, [0, 0.45], [0.55, 1]);

  // Kịch bản demo tự chạy trong cửa sổ — như video sản phẩm của Attio.
  const { phase, tick } = useDemoLoop();

  // Opacity ghi thẳng vào DOM: để motion tự bind style opacity thì nó hand-off
  // sang native ScrollTimeline với keyframes SAI (đo được opacity ≈ progress,
  // bỏ qua mapping). Transform không dính lỗi này.
  const fadeRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  useMotionValueEvent(headOpacity, "change", (v) => {
    if (fadeRef.current) fadeRef.current.style.opacity = String(v);
  });
  useMotionValueEvent(washOpacity, "change", (v) => {
    if (washRef.current) washRef.current.style.opacity = String(v);
  });

  return (
    <section ref={heroRef} className="relative h-[240vh]">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* Gradient tím-lam đậm dần khi cảnh mở ra — chữ ký của Attio */}
        <div
          ref={washRef}
          aria-hidden="true"
          style={{
            opacity: 0.55,
            background:
              "radial-gradient(85% 70% at 50% 72%, var(--landing-wash) 0%, var(--landing-wash-soft) 48%, transparent 74%)",
          }}
          className="pointer-events-none absolute inset-x-0 top-[26%] bottom-0"
        />

        {/* Headline — lùi và mờ dần khi cuộn. Lớp fade là div thường,
            opacity ghi qua useMotionValueEvent (xem ghi chú ở trên). */}
        <motion.div
          style={{ y: headY }}
          className="relative z-10 mx-auto max-w-[1120px] px-5 pt-20 text-center sm:px-8 sm:pt-24"
        >
          <div ref={fadeRef} style={{ opacity: 1 }}>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.09 } } }}
            >
              <HeroItem>
                <a
                  href="#how-it-works"
                  className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] text-soft transition-colors duration-150 hover:border-line-strong hover:text-text"
                >
                  The chatbot that learns from your documents
                  <ChevronLeftIcon className="size-3.5 rotate-180 transition-transform duration-150 group-hover:translate-x-0.5" />
                </a>
              </HeroItem>

              <HeroItem>
                {/* Kiểu chữ Attio: sans rất đậm, tracking âm sâu — không phải serif */}
                <h1 className="mx-auto mt-6 max-w-3xl font-sans text-[46px] leading-[1.04] font-bold tracking-[-0.035em] sm:text-[72px]">
                  Your documents,
                  <br />
                  answering for you.
                </h1>
              </HeroItem>

              <HeroItem>
                <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-soft sm:text-[17px]">
                  Pengbot reads your price lists, policies, and guides — then
                  answers your customers right on your website, with sources
                  cited, 24/7. No code required.
                </p>
              </HeroItem>

              <HeroItem>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="#how-it-works"
                    className={cn(lightBtn, "h-11 px-6 text-[15px]")}
                  >
                    See how it works
                  </a>
                  <Link
                    to={loggedIn ? "/app" : "/register"}
                    className={cn(darkBtn, "h-11 px-6 text-[15px]")}
                  >
                    {loggedIn ? "Open dashboard" : "Start for free"}
                  </Link>
                </div>
                <p className="mt-4 text-[13px] text-faint">
                  Free to start · Live on your site in 5 minutes
                </p>
              </HeroItem>
            </motion.div>
          </div>
        </motion.div>

        {/* Cảnh sản phẩm — cửa sổ chính + ba vệ tinh bay lên khi cuộn */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 z-20"
        >
          <div className="relative mx-auto h-full max-w-[920px] px-5 sm:px-0">
            <motion.div style={{ y: winY, scale: winScale }}>
              <HeroWindow phase={phase} />
            </motion.div>

            {/* Vệ tinh trái trên: hội thoại vừa đến — card khung-trong-khung
                với avatar + tên + giờ, như thẻ Slack trong hero của Attio */}
            <motion.div
              style={{ y: satAY }}
              className="absolute top-6 -left-56 hidden w-[240px] xl:block"
            >
              <div className="rounded-2xl bg-sunken p-1.5 text-left shadow-window">
                <div className="flex items-center gap-1.5 px-2 pt-0.5 pb-1.5 font-mono text-[9px] tracking-[0.12em] text-faint uppercase">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                  </span>
                  New conversation
                </div>
                <div className="space-y-2.5 rounded-[10px] border border-line bg-surface p-3">
                  <div className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-sunken text-[9px] font-semibold text-soft">
                      K
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10.5px] leading-tight">
                        <span className="font-semibold">Visitor v_2841</span>{" "}
                        <span className="text-faint">14:02</span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-soft">
                        Can I get a VAT invoice for order #2841?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-[9px] font-semibold text-on-accent">
                      P
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10.5px] leading-tight">
                        <span className="font-semibold">Pengbot</span>{" "}
                        <span className="rounded-sm bg-sunken px-1 py-px align-[1px] text-[7.5px] font-medium text-faint">
                          BOT
                        </span>{" "}
                        <span className="text-faint">14:02</span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-soft">
                        Answered — cited "Invoicing guide".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Vệ tinh trái dưới: terminal — ô lệnh riêng, ô nhập, footer cam
                như terminal đen trong hero của Attio */}
            <motion.div
              style={{ y: satBY }}
              className="absolute top-[44%] -left-44 hidden w-[264px] xl:block"
            >
              <div className="rounded-2xl border border-black/50 bg-[#101514] p-1.5 text-left font-mono shadow-window">
                <span className="flex gap-1.5 px-2 pt-1 pb-2">
                  <span className="size-2 rounded-full bg-[#F45952]" />
                  <span className="size-2 rounded-full bg-[#F5B83D]" />
                  <span className="size-2 rounded-full bg-[#34C748]" />
                </span>
                <div className="min-h-[118px] space-y-1.5 rounded-[10px] bg-[#0B0F0E] p-2.5 text-[10.5px] leading-relaxed text-[#B7C2BF]">
                  {phase === "docs" ? (
                    <TerminalLive key={tick} />
                  ) : (
                    <>
                      <div className="rounded-md bg-[#161C1A] px-2 py-1.5">
                        &gt; pengbot learn "price-list-2026.pdf"
                      </div>
                      <div className="px-2 text-[#4FAE90]">
                        ✓ 12 pages · 42 chunks
                      </div>
                      <div className="px-2 text-[#4FAE90]">
                        ✓ ready to answer in 38s
                      </div>
                      <div className="rounded-md border border-[#232B29] px-2 py-1.5 text-[#5E6A67]">
                        &gt;
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 px-2.5 pt-1.5 pb-1 text-[9px] text-[#E0A458]">
                  ▶▶ auto · 42 chunks · 38s
                </div>
              </div>
            </motion.div>

            {/* Vệ tinh phải: widget chat, bọc khung đệm có nhãn ngữ cảnh */}
            <motion.div
              style={{ y: satCY }}
              className="absolute top-10 -right-56 hidden w-[272px] xl:block"
            >
              <div className="rounded-2xl bg-sunken p-1.5 shadow-window">
                <div className="px-2 pt-0.5 pb-1.5 font-mono text-[9px] tracking-[0.12em] text-faint uppercase">
                  On your customer's site
                </div>
                <div className="overflow-hidden rounded-[10px] border border-line bg-white">
                  <div className="flex items-center justify-between bg-[#166F5C] px-3.5 py-2.5 text-white">
                    <div>
                      <div className="text-[12px] leading-tight font-semibold">
                        ACME Customer Support
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9.5px] opacity-80">
                        <span className="inline-block size-1 rounded-full bg-white" />
                        Typically replies instantly
                      </div>
                    </div>
                  </div>
                  <WidgetBody live={phase === "chat"} tick={tick} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroItem({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 22 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────── Demo tự chạy trong cửa sổ ─────────────────────
   Kịch bản lặp: Tổng quan (số đếm, cột mọc) → con trỏ bấm "Tài liệu"
   (file mới tải lên, Processing → Ready, terminal gõ chữ) → con trỏ
   bấm "Hội thoại" (widget tự gõ câu hỏi, bot trả lời kèm nguồn). */

type DemoPhase = "overview" | "docs" | "chat";

const DEMO_STEPS: { id: DemoPhase; ms: number }[] = [
  { id: "overview", ms: 4200 },
  { id: "docs", ms: 5400 },
  { id: "chat", ms: 6400 },
];

/** tick tăng đơn điệu qua từng cảnh — dùng làm key để remount animation. */
function useDemoLoop() {
  const [tick, setTick] = useState(0);
  const step = DEMO_STEPS[tick % DEMO_STEPS.length];

  useEffect(() => {
    const timer = setTimeout(() => setTick((v) => v + 1), step.ms);
    return () => clearTimeout(timer);
  }, [tick, step.ms]);

  return { phase: step.id, tick };
}

/** Chữ tự gõ từng ký tự. Remount (đổi key) là gõ lại từ đầu. */
function TypeText({
  text,
  cps = 26,
  startDelay = 0,
  caret = false,
  className,
}: {
  text: string;
  cps?: number;
  startDelay?: number;
  caret?: boolean;
  className?: string;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(() => {
      interval = setInterval(
        () => setN((v) => (v < text.length ? v + 1 : v)),
        1000 / cps,
      );
    }, startDelay);
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [text, cps, startDelay]);

  return (
    <span className={className}>
      {text.slice(0, n)}
      {caret && n < text.length ? (
        <span className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-current" />
      ) : null}
    </span>
  );
}

/** Số đếm chạy lên khi cảnh Tổng quan mở ra. */
function CountUp({ to, duration = 1000 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return <>{value}</>;
}

/** Terminal gõ chữ trong cảnh Tài liệu — cùng bố cục ô lệnh với bản tĩnh. */
function TerminalLive() {
  return (
    <>
      <div className="rounded-md bg-[#161C1A] px-2 py-1.5">
        &gt;{" "}
        <TypeText text={'pengbot learn "price-list-2026.pdf"'} cps={30} caret />
      </div>
      <motion.div
        className="px-2 text-[#4FAE90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.2 }}
      >
        ✓ 12 pages · 42 chunks
      </motion.div>
      <motion.div
        className="px-2 text-[#4FAE90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.4, duration: 0.2 }}
      >
        ✓ ready to answer in 38s
      </motion.div>
      <motion.div
        className="rounded-md border border-[#232B29] px-2 py-1.5 text-[#5E6A67]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 4.1, duration: 0.2 }}
      >
        &gt;
      </motion.div>
    </>
  );
}

/** Ba chấm "đang gõ" của bot. */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-[#9A9A9A]"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/**
 * Thân widget: cảnh Hội thoại thì diễn tuần tự — khách gõ câu hỏi vào ô
 * nhập, gửi thành bong bóng, bot chấm chấm suy nghĩ rồi trả lời kèm nguồn.
 * Ngoài cảnh đó thì đứng yên ở trạng thái đã trả lời xong.
 */
function WidgetBody({ live, tick }: { live: boolean; tick: number }) {
  return live ? <WidgetLive key={tick} /> : <WidgetSettled />;
}

const WIDGET_Q = "How long do refunds take?";
const WIDGET_A =
  "Refunds are issued within 5–7 business days after we receive your return.";

function WidgetLive() {
  // 0: đang gõ vào ô nhập · 1: đã gửi · 2: bot đang nghĩ · 3: bot trả lời
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1700),
      setTimeout(() => setStep(2), 2100),
      setTimeout(() => setStep(3), 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      <div className="min-h-[132px] space-y-2 bg-[#FAFAFA] px-3 py-3.5">
        {step >= 1 ? (
          <motion.div
            className="flex justify-end"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="max-w-[85%] rounded-xl rounded-br-sm bg-[#166F5C] px-2.5 py-1.5 text-[11px] leading-snug text-white">
              {WIDGET_Q}
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-bl-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <TypingDots />
            </div>
          </div>
        ) : null}

        {step >= 3 ? (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[11px] leading-snug text-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <TypeText text={WIDGET_A} cps={55} />
              <motion.div
                className="mt-1.5 border-t border-[#EDEDED] pt-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.25 }}
              >
                <span className="inline-block rounded-full bg-[#ECF6F2] px-1.5 py-0.5 text-[9px] text-[#166F5C]">
                  Source: 2025 Return Policy
                </span>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-[#EDEDED] bg-white px-2.5 py-2">
        <div className="flex-1 text-[10.5px] text-[#1A1A1A]">
          {step === 0 ? (
            <TypeText text={WIDGET_Q} cps={20} startDelay={250} caret />
          ) : (
            <span className="text-[#9A9A9A]">Type your question…</span>
          )}
        </div>
        <motion.div
          className="flex size-6 items-center justify-center rounded-full bg-[#166F5C] text-white"
          animate={step === 1 ? { scale: [1, 0.82, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <SendIcon className="size-3" />
        </motion.div>
      </div>
    </>
  );
}

function WidgetSettled() {
  return (
    <>
      <div className="min-h-[132px] space-y-2 bg-[#FAFAFA] px-3 py-3.5">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-xl rounded-br-sm bg-[#166F5C] px-2.5 py-1.5 text-[11px] leading-snug text-white">
            {WIDGET_Q}
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[11px] leading-snug text-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            {WIDGET_A}
            <div className="mt-1.5 border-t border-[#EDEDED] pt-1.5">
              <span className="inline-block rounded-full bg-[#ECF6F2] px-1.5 py-0.5 text-[9px] text-[#166F5C]">
                Source: 2025 Return Policy
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[#EDEDED] bg-white px-2.5 py-2">
        <div className="flex-1 text-[10.5px] text-[#9A9A9A]">
          Type your question…
        </div>
        <div className="flex size-6 items-center justify-center rounded-full bg-[#166F5C] text-white">
          <SendIcon className="size-3" />
        </div>
      </div>
    </>
  );
}

/* ───────────────────── Cửa sổ dashboard tự diễn ───────────────────── */

const NAV_ITEMS = ["Overview", "Documents", "Conversations", "Settings"];
const PHASE_NAV: Record<DemoPhase, number> = { overview: 0, docs: 1, chat: 2 };

/** Toạ độ con trỏ giả, tính từ góc trái trên cửa sổ. */
const CURSOR_POS: Record<DemoPhase, { x: number; y: number }> = {
  overview: { x: 76, y: 138 },
  docs: { x: 72, y: 166 },
  chat: { x: 78, y: 194 },
};

function HeroWindow({ phase }: { phase: DemoPhase }) {
  const activeNav = PHASE_NAV[phase];
  const cursor = CURSOR_POS[phase];

  return (
    <div className="relative mx-auto max-w-[920px]" aria-hidden="true">
      {/* Khung-trong-khung kiểu Attio: đệm sunken bo lớn ôm panel trắng */}
      <div className="rounded-2xl bg-sunken p-1.5 text-left shadow-window">
        <div className="flex items-center gap-3 px-2.5 pt-1 pb-2">
          {/* Ba chấm màu thật — như cửa sổ macOS trong hero của Attio */}
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#F45952]" />
            <span className="size-2.5 rounded-full bg-[#F5B83D]" />
            <span className="size-2.5 rounded-full bg-[#34C748]" />
          </span>
          <span className="mx-auto rounded-md border border-line bg-surface px-6 py-0.5 font-mono text-[11px] text-faint">
            app.pengbot.vn
          </span>
          <span className="w-12" />
        </div>

        <div className="grid overflow-hidden rounded-[10px] border border-line bg-surface grid-cols-[168px_minmax(0,1fr)] max-sm:grid-cols-1">
          {/* Sidebar — mục sáng theo cảnh đang diễn */}
          <div className="border-r border-line px-4 py-5 max-sm:hidden">
            <div className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">
              Dashboard
            </div>
            <div className="mt-1 font-display text-[15px] font-medium">
              ACME Inc.
            </div>
            <div className="mt-5 space-y-1">
              {NAV_ITEMS.map((item, i) => (
                <div
                  key={item}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[12px] transition-colors duration-200",
                    i === activeNav
                      ? "bg-hover font-medium text-text"
                      : "text-faint",
                  )}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Nội dung — đổi theo cảnh, chờ con trỏ bấm xong mới vào */}
          <div className="relative h-[398px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={phase}
                className="absolute inset-0 px-6 py-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: EASE, delay: 0.55 }}
              >
                {phase === "overview" ? (
                  <OverviewPane />
                ) : phase === "docs" ? (
                  <DocsPane />
                ) : (
                  <ChatPane />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Con trỏ chuột giả — trượt tới mục điều hướng rồi nhấp */}
      <motion.div
        className="pointer-events-none absolute top-0 left-0 z-20 hidden sm:block"
        initial={false}
        animate={{ x: cursor.x, y: cursor.y }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <motion.span
          key={phase}
          className="absolute -top-2.5 -left-2.5 size-6 rounded-full border-2 border-accent"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.3, 1.5, 1.7] }}
          transition={{ delay: 0.58, duration: 0.55, times: [0, 0.35, 1] }}
        />
        <svg
          width="17"
          height="20"
          viewBox="0 0 17 20"
          className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        >
          <path
            d="M1 1l6.2 15.6 2.1-6.1 6.3-1.3L1 1Z"
            fill="#101514"
            stroke="#FFFFFF"
            strokeWidth="1.4"
          />
        </svg>
      </motion.div>
    </div>
  );
}

/* ───── Cảnh 1: Tổng quan — số đếm chạy, cột biểu đồ mọc lên ───── */

const CHART_BARS = [
  38, 22, 25, 44, 40, 30, 52, 34, 26, 58, 42, 35, 65, 48, 92, 55, 44, 68, 60,
  50, 72, 40,
];

function OverviewPane() {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">
        Overview
      </div>
      <div className="mt-1 font-display text-[22px] font-medium">
        Your chatbot
      </div>

      <div className="mt-5 grid grid-cols-3 gap-5">
        {[
          ["AI messages", 773],
          ["Documents", 6],
          ["Chunks learned", 133],
        ].map(([label, value]) => (
          <div key={label as string} className="border-t border-line pt-2.5">
            <div className="text-[11px] text-faint">{label}</div>
            <div className="mt-0.5 text-[22px] leading-none font-semibold">
              <CountUp to={value as number} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-line p-4">
        <div className="text-[12px] font-medium">AI messages per day</div>
        <div className="mt-3 flex h-[86px] items-end gap-[5px]">
          {CHART_BARS.map((h, i) => (
            <motion.div
              key={i}
              className={cn(
                "flex-1 origin-bottom rounded-t-[3px] bg-accent",
                h < 90 && "opacity-[.82]",
              )}
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                delay: 0.15 + i * 0.035,
                duration: 0.4,
                ease: EASE,
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2.5 max-sm:hidden">
        {[
          [
            "I bought a shirt yesterday — can I exchange the size?",
            "4 min ago",
          ],
          ["How long is the water purifier warranty?", "44 min ago"],
        ].map(([q, t]) => (
          <div
            key={q}
            className="flex items-center justify-between gap-4 text-[12px]"
          >
            <span className="truncate text-soft">{q}</span>
            <span className="shrink-0 text-[11px] text-faint">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Cảnh 2: Tài liệu — file mới tải lên, học xong chuyển Ready ───── */

const DOC_ROWS: [string, string, number][] = [
  ["2025 Return & Refund Policy", "PDF", 42],
  ["Product Warranty Terms", "DOCX", 28],
  ["Customer FAQ", "MD", 63],
];

function DocsPane() {
  // false: hàng mới đang xử lý · true: đã học xong
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 3600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">
        Documents
      </div>
      <div className="mt-1 font-display text-[22px] font-medium">
        Knowledge base
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_44px] gap-3 border-b border-line bg-sunken px-4 py-2 text-[10px] text-faint">
          <span>Document</span>
          <span>Status</span>
          <span className="text-right">Chunks</span>
        </div>

        {/* Hàng mới trượt vào sau khi "tải lên" */}
        <motion.div
          className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-3 border-b border-line bg-accent-soft/60 px-4 py-2.5 text-[12px]"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.35, ease: EASE }}
        >
          <div className="min-w-0">
            <div className="truncate font-medium">2026 Price List</div>
            <div className="truncate font-mono text-[10px] text-faint">
              price-list-2026.pdf
            </div>
          </div>
          {ready ? (
            <motion.span
              className="inline-flex w-fit items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-text"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <span className="size-1 rounded-full bg-accent" />
              Ready
            </motion.span>
          ) : (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-warn-line bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
              <span className="size-1 animate-pulse rounded-full bg-warn" />
              Processing
            </span>
          )}
          <span className="text-right text-soft tabular-nums">
            {ready ? 42 : "—"}
          </span>
        </motion.div>

        {DOC_ROWS.map(([title, type, chunks]) => (
          <div
            key={title}
            className="grid grid-cols-[minmax(0,1fr)_88px_44px] items-center gap-3 border-b border-line px-4 py-2.5 text-[12px] last:border-0"
          >
            <div className="min-w-0">
              <div className="truncate">{title}</div>
              <div className="font-mono text-[10px] text-faint">{type}</div>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-text">
              <span className="size-1 rounded-full bg-accent" />
              Ready
            </span>
            <span className="text-right text-soft tabular-nums">{chunks}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-faint">
        {ready ? (
          <>
            <CheckIcon className="size-3 text-accent" />
            Learned — the bot can answer from it right away.
          </>
        ) : (
          <>
            <span className="size-1.5 animate-pulse rounded-full bg-warn" />
            Processing document — the list updates itself.
          </>
        )}
      </p>
    </div>
  );
}

/* ───── Cảnh 3: Hội thoại — câu hỏi từ widget đổ về dashboard ───── */

function ChatPane() {
  // 0: chưa có gì · 1: câu hỏi tới · 2: bot đã trả lời
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 2300),
      setTimeout(() => setStep(2), 3700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="font-mono text-[9px] tracking-[0.14em] text-faint uppercase">
        Conversations
      </div>
      <div className="mt-1 font-display text-[22px] font-medium">
        What customers asked
      </div>

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-[176px_minmax(0,1fr)] gap-4">
        {/* Danh sách trái */}
        <div className="space-y-1 overflow-hidden">
          {step >= 1 ? (
            <motion.div
              className="rounded-md border-l-2 border-accent bg-accent-soft px-3 py-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <p className="truncate text-[11.5px] font-medium">{WIDGET_Q}</p>
              <p className="mt-0.5 text-[10px] text-faint">
                just now · 2 messages
              </p>
            </motion.div>
          ) : null}
          {[
            ["I bought a shirt yesterday — can I…", "4 min ago"],
            ["How long is the water purifier warranty?", "44 min ago"],
            ["When will my order arrive in Da Nang?", "3 hours ago"],
          ].map(([q, t]) => (
            <div key={q} className="px-3 py-2">
              <p className="truncate text-[11.5px] text-soft">{q}</p>
              <p className="mt-0.5 text-[10px] text-faint">{t}</p>
            </div>
          ))}
        </div>

        {/* Nội dung phải */}
        <div className="space-y-2.5 rounded-lg border border-line p-4">
          {step >= 1 ? (
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-sunken px-3 py-1.5 text-[12px]">
                {WIDGET_Q}
              </div>
            </motion.div>
          ) : (
            <p className="pt-6 text-center text-[11px] text-faint">
              Waiting for new conversations…
            </p>
          )}
          {step >= 2 ? (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div className="max-w-[90%] rounded-lg rounded-bl-sm border border-line px-3 py-1.5 text-[12px]">
                {WIDGET_A}
                <div className="mt-1.5 flex items-center gap-1 border-t border-line pt-1.5 text-[10px] text-faint">
                  <DocumentIcon className="size-2.5" />
                  Source: 2025 Return Policy
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Dải khách hàng ───────────────────────── */

const CUSTOMERS = [
  "Moc Furniture",
  "Sen Spa",
  "TechViet",
  "EduPro",
  "Green Garden",
  "Anh Thu Store",
];

function LogoStrip() {
  return (
    <section className="border-y border-line bg-surface">
      <Reveal className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8">
        <p className="text-center font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
          Trusted by customer support teams
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {CUSTOMERS.map((name) => (
            <span
              key={name}
              className="font-display text-[17px] font-medium text-faint select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Ba bước ───────────────────────── */

const STEPS = [
  {
    step: "01",
    title: "Upload your documents",
    body: "Drag and drop PDFs, Word files, or plain text: price lists, return policies, FAQs. The system reads and learns them in minutes.",
  },
  {
    step: "02",
    title: "Paste one line of script",
    body: "Copy the embed snippet and paste it into your website — WordPress, Shopify, Wix, or custom code. Paste once, never again.",
  },
  {
    step: "03",
    title: "The bot answers 24/7",
    body: "Customers ask, the bot answers from your documents — with sources. If something isn't covered, it says so instead of making things up.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-sans text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[42px]">
            From documents to answers,
            <br />
            in 5 minutes.
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
          {STEPS.map(({ step, title, body }, i) => (
            <Reveal key={step} delay={i * 0.1} className="h-full">
              <li className="h-full bg-surface p-8">
                <div className="font-mono text-[12px] tracking-[0.14em] text-faint">
                  {step}
                </div>
                <h3 className="mt-3 font-sans text-[19px] font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-soft">
                  {body}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────────────────────── Tính năng ───────────────────────── */

function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-20 border-t border-line bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Features</p>
          <h2 className="mt-3 font-sans text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[42px]">
            Answers right — and knows
            <br />
            what it doesn't know.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-soft">
            Unlike scripted chatbots, Pengbot only answers from the documents
            you provide. Every answer traces back to its source.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <FeatureCard
            index={0}
            title="Every answer cites its source"
            body="Each answer shows the document it came from. You can verify it, your customers can trust it."
          >
            <div className="rounded-xl rounded-bl-sm border border-line bg-canvas px-4 py-3 text-[13px] leading-relaxed">
              We accept returns within 30 days of delivery.
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-faint">
                  <DocumentIcon className="size-3" />
                  Source: 2025 Return Policy
                </span>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            index={1}
            title="Shows where your docs fall short"
            body="Low-confidence answers are flagged — that's exactly the content you should write next."
          >
            <div>
              <div className="rounded-xl rounded-bl-sm border border-warn-line border-l-2 border-l-warn bg-canvas px-4 py-3 text-[13px]">
                Sorry, I don't have information about that.
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-warn">
                <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
                The bot wasn't sure here — your documents may not cover it.
              </p>
            </div>
          </FeatureCard>

          <FeatureCard
            index={2}
            title="Wears your brand colors"
            body="Change the name, greeting, and colors — with a live preview. Your customers see your brand, not ours."
          >
            <div className="flex gap-3">
              {[
                ["#166F5C", "ACME"],
                ["#7C3A2E", "Moc"],
                ["#31456E", "Sen Spa"],
              ].map(([color, name]) => (
                <div
                  key={color}
                  className="flex-1 overflow-hidden rounded-lg border border-line bg-white"
                >
                  <div
                    className="px-3 py-2 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {name}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="h-1.5 w-4/5 rounded-full bg-[#EDEDED]" />
                    <div className="h-1.5 w-3/5 rounded-full bg-[#EDEDED]" />
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>

          <FeatureCard
            index={3}
            title="Runs only on your website"
            body="Restrict which domains can embed the widget. Even if someone copies your snippet, they can't steal your chatbot."
          >
            <div className="flex flex-wrap items-center gap-2">
              {["acme.vn", "shop.acme.vn"].map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1 font-mono text-[12px] text-accent-text"
                >
                  <CheckIcon className="size-3" />
                  {domain}
                </span>
              ))}
              <span className="inline-flex items-center rounded-full border border-line px-3 py-1 font-mono text-[12px] text-faint line-through opacity-60">
                other-site.com
              </span>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <Reveal delay={(index % 2) * 0.1} className="h-full">
      <div className="flex h-full flex-col rounded-lg border border-line bg-canvas p-8">
        <h3 className="font-sans text-[19px] font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-soft">{body}</p>
        <div className="mt-6 flex-1" aria-hidden="true">
          {children}
        </div>
      </div>
    </Reveal>
  );
}

/* ───────────────── Section đen: Company Memory ─────────────────
   Bản Pengbot của khối "Universal Context" bên Attio: nền đen toàn màn,
   vầng nhật thực phát sáng, lưới 5 thẻ, và khối Tín hiệu với danh sách
   tự chuyển cảnh + radar. Màu cố định, không theo theme. */

const DARK_CARDS: { Icon: typeof DocumentIcon; title: string; body: string }[] =
  [
    {
      Icon: DocumentIcon,
      title: "Reads your docs.",
      body: "PDF, Word, price lists — learned in minutes.",
    },
    {
      Icon: CheckIcon,
      title: "Cites its sources.",
      body: "Every answer traces back to the original document.",
    },
    {
      Icon: AlertIcon,
      title: "Knows what it doesn't know.",
      body: "If it's not in your docs, it says so — no guessing.",
    },
    {
      Icon: ChatIcon,
      title: "Ask, and it's there.",
      body: "Seconds per answer, 24/7 without a break.",
    },
    {
      Icon: OverviewIcon,
      title: "Gets smarter with use.",
      body: "Weak answers show exactly where your docs fall short.",
    },
  ];

const SIGNALS: { title: string; body: string }[] = [
  {
    title: "Repeated questions",
    body: "Customers keep asking the same thing — that belongs right on your homepage.",
  },
  {
    title: "Low-confidence answers",
    body: "Low confidence marks exactly where your documents fall short.",
  },
  {
    title: "Emerging topics",
    body: "New products bring new questions — spot them early, fill the gap fast.",
  },
];

function ContextSection() {
  return (
    <section className="overflow-hidden bg-[#060807] text-white">
      {/* Kẻ dọc mờ toàn khối — chi tiết nền của Attio */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 90px)",
          }}
        />

        {/* Tiêu đề + nhật thực */}
        <div className="relative pt-24 text-center sm:pt-28">
          <Reveal>
            <p className="text-[15px] text-[#8A9390]">The only chatbot with</p>
            <h2 className="mt-3 font-sans text-[52px] leading-none font-bold tracking-[-0.04em] text-white sm:text-[84px]">
              Company Memory
              <sup className="ml-1 align-super text-[0.32em] font-semibold tracking-normal">
                TM
              </sup>
            </h2>
          </Reveal>

          {/* Vầng nhật thực: NỬA VÒM chạm hai mép như Attio — overflow-hidden
              cắt cụt tại đáy, vòng tròn không lộ xuống các khối bên dưới.
              Ba lớp đồng tâm: quầng khí quyển mờ → viền sắc → hành tinh đen
              nhỏ hơn 12px, chừa vành sáng đều quanh rìa. */}
          <div
            aria-hidden="true"
            className="relative mt-16 h-[300px] overflow-hidden sm:h-[360px]"
          >
            {/* quầng khí quyển lan rộng */}
            <div
              className="absolute top-[40px] left-1/2 aspect-square -translate-x-1/2 rounded-full opacity-55"
              style={{
                width: "calc(max(150vw, 860px) + 16px)",
                background:
                  "linear-gradient(90deg, #7A1A0A, #D4491A 16%, #F2B84B 35%, #FFF9E8 50%, #8FE0CD 65%, #2E7F86 82%, #1E4E7A)",
                filter: "blur(56px)",
              }}
            />
            {/* viền sáng sắc — đỏ → cam → trắng → ngọc → lam */}
            <div
              className="absolute top-[48px] left-1/2 aspect-square -translate-x-1/2 rounded-full"
              style={{
                width: "max(150vw, 860px)",
                background:
                  "linear-gradient(90deg, #7A1A0A, #D4491A 16%, #F2B84B 35%, #FFF9E8 50%, #8FE0CD 65%, #2E7F86 82%, #1E4E7A)",
                filter: "blur(6px)",
              }}
            />
            {/* hành tinh đen đồng tâm, chừa vành sáng 6px quanh rìa */}
            <div
              className="absolute top-[54px] left-1/2 aspect-square -translate-x-1/2 rounded-full bg-[#050706]"
              style={{ width: "calc(max(150vw, 860px) - 12px)" }}
            />
          </div>
        </div>

        {/* Lưới 5 thẻ */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 md:grid-cols-5">
            {DARK_CARDS.map(({ Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.07}
                className={cn(
                  "border-white/10 max-md:[&:nth-child(odd)]:border-r max-md:[&:not(:nth-last-child(-n+1))]:border-b",
                  "md:border-b-0",
                  i > 0 && "md:border-l",
                )}
              >
                <div className="flex h-full min-h-[220px] flex-col justify-between p-7">
                  <Icon className="size-5 text-[#8A9390]" />
                  <div>
                    <h3 className="font-sans text-[15px] font-semibold tracking-tight text-white">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A9390]">
                      {body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Khối Tín hiệu: danh sách tự chuyển + radar */}
        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-[1280px] md:grid-cols-2">
            <div className="border-white/10 px-7 py-16 sm:px-12 sm:py-20 md:border-r">
              <Reveal>
                <span className="inline-block rounded-md bg-[#1B2340] px-2.5 py-1 text-[12px] font-medium text-[#9DB1F2]">
                  Signals
                </span>
                <h2 className="mt-6 max-w-md font-sans text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-white sm:text-[38px]">
                  Every question is a signal.{" "}
                  <span className="text-[#707A77]">
                    Don't let it slip away.
                  </span>
                </h2>
              </Reveal>

              <SignalList />

              <Reveal delay={0.1}>
                <Link
                  to="/register"
                  className="mt-12 inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/5"
                >
                  See your conversations
                  <ChevronLeftIcon className="size-3.5 rotate-180" />
                </Link>
              </Reveal>
            </div>

            <RadarVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Danh sách tự chuyển cảnh 3.2s/mục — mục đang nói sáng lên kèm thanh chạy. */
function SignalList() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setActive((v) => (v + 1) % SIGNALS.length),
      3200,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-12 space-y-8">
      {SIGNALS.map((signal, i) => {
        const on = i === active;
        return (
          <button
            key={signal.title}
            type="button"
            onClick={() => setActive(i)}
            className="block w-full text-left"
          >
            <h3
              className={cn(
                "font-sans text-[19px] font-semibold tracking-tight transition-colors duration-300",
                on ? "text-white" : "text-[#707A77]",
              )}
            >
              {signal.title}
            </h3>
            <AnimatePresence initial={false}>
              {on ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="max-w-sm pt-2 text-[14px] leading-relaxed text-[#8A9390]">
                    {signal.body}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <div className="mt-3 h-px w-full bg-white/10">
              {on ? (
                <motion.div
                  key={active}
                  className="h-px bg-white/50"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.2, ease: "linear" }}
                />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Radar đồng tâm với chấm tín hiệu nhấp nháy — hình bên phải khối Tín hiệu. */
function RadarVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative min-h-[380px] overflow-hidden md:min-h-[520px]"
    >
      <svg
        viewBox="0 0 640 640"
        className="absolute top-1/2 left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2"
      >
        {[90, 165, 240, 310].map((r) => (
          <circle
            key={r}
            cx="320"
            cy="320"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
            strokeDasharray={r === 310 ? "3 7" : undefined}
          />
        ))}
        <line
          x1="320"
          y1="10"
          x2="320"
          y2="630"
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="3 7"
        />
        <line
          x1="10"
          y1="320"
          x2="630"
          y2="320"
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="3 7"
        />
        {/* kim quét */}
        <line
          x1="320"
          y1="320"
          x2="320"
          y2="150"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
        />
      </svg>

      {/* tâm */}
      <motion.span
        className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
      {/* sóng lan từ tâm */}
      <motion.span
        className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
        animate={{ scale: [1, 22], opacity: [0.6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut" }}
      />
      {/* chấm tín hiệu trên các vòng */}
      {[
        { left: "38%", top: "26%", delay: 0 },
        { left: "68%", top: "38%", delay: 1.1 },
        { left: "30%", top: "62%", delay: 2.2 },
      ].map((dot) => (
        <motion.span
          key={dot.left}
          className="absolute size-1.5 rounded-full bg-white/80"
          style={{ left: dot.left, top: dot.top }}
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{ duration: 3.3, repeat: Infinity, delay: dot.delay }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Nền tảng tích hợp ───────────────────────── */

const PLATFORMS = [
  "WordPress",
  "Shopify",
  "Haravan",
  "Sapo",
  "Wix",
  "Squarespace",
  "Webflow",
  "Custom sites",
];

function Integrations() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1120px] px-5 py-24 text-center sm:px-8">
        <Reveal>
          <p className="eyebrow">Integrations</p>
          <h2 className="mt-3 font-sans text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[42px]">
            Runs on whatever you already use.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-soft">
            One snippet works on any website. No plugins, no SDKs, no platform
            lock-in.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {PLATFORMS.map((name) => (
              <span
                key={name}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-soft"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── Câu chuyện khách hàng ───────────────────────── */

function Testimonial() {
  return (
    <section className="border-t border-line bg-surface">
      <Reveal className="mx-auto max-w-[880px] px-5 py-24 text-center sm:px-8">
        <p className="font-sans text-[24px] leading-snug font-semibold tracking-[-0.015em] sm:text-[30px]">
          "Three of us used to take turns answering our fanpage until 10pm. Now
          Pengbot handles most order and return questions — my team only steps
          in when a human is truly needed."
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-text">
            MC
          </span>
          <div className="text-left">
            <div className="text-sm font-medium">Minh Chi Nguyen</div>
            <div className="text-[12.5px] text-faint">
              Retail chain owner — ACME Inc.
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-start justify-center gap-x-16 gap-y-6">
          <div>
            <div className="font-sans text-[32px] leading-none font-semibold tracking-tight">
              70%
            </div>
            <div className="mt-1.5 text-[13px] text-faint">
              of questions handled by the bot
            </div>
          </div>
          <div>
            <div className="font-sans text-[32px] leading-none font-semibold tracking-tight">
              3 hours
            </div>
            <div className="mt-1.5 text-[13px] text-faint">
              less page duty every day
            </div>
          </div>
          <div>
            <div className="font-sans text-[32px] leading-none font-semibold tracking-tight">
              2 minutes
            </div>
            <div className="mt-1.5 text-[13px] text-faint">
              actual setup time
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Dải số liệu ───────────────────────── */

const METRICS = [
  ["5 minutes", "from sign-up to live on your site"],
  ["24/7", "always on, even on holidays"],
  ["1 line of code", "is all you need to paste"],
  ["100%", "of answers backed by sources"],
];

function MetricsBand() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-x-8 gap-y-10 px-5 py-16 sm:px-8 lg:grid-cols-4">
        {METRICS.map(([value, label], i) => (
          <Reveal key={value} delay={i * 0.07}>
            <div className="border-t border-line pt-4">
              <div className="font-sans text-[34px] leading-none font-semibold tracking-tight">
                {value}
              </div>
              <div className="mt-2 text-[13px] leading-snug text-faint">
                {label}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Bảng giá ───────────────────────── */

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    highlight: false,
    cta: "Start for free",
    features: [
      "1 chatbot",
      "5 documents",
      "200 AI messages per month",
      "Source citations",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    highlight: true,
    cta: "Try Pro",
    features: [
      "Unlimited documents",
      "5,000 AI messages per month",
      "Full brand customization",
      "Priority document processing",
      "Email support within 24h",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "tailored to you",
    highlight: false,
    cta: "Talk to us",
    features: [
      "Multiple chatbots and websites",
      "Unlimited messages",
      "Service-level agreement (SLA)",
      "Dedicated onboarding support",
    ],
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-line bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-3 font-sans text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[42px]">
            Start free, pay as you grow.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-soft">
            No credit card required. Upgrade or cancel anytime.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-lg border bg-canvas p-8",
                  plan.highlight
                    ? "border-line-strong shadow-pop"
                    : "border-line",
                )}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-8 rounded-full bg-text px-3 py-0.5 text-[11px] font-medium text-inverse">
                    Most popular
                  </span>
                ) : null}

                <h3 className="font-sans text-[17px] font-semibold tracking-tight">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-sans text-[36px] leading-none font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-[13px] text-faint">{plan.period}</span>
                </div>

                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-soft"
                    >
                      <CheckIcon className="mt-1 size-3.5 shrink-0 text-faint" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={cn(
                    plan.highlight ? darkBtn : lightBtn,
                    "mt-8 h-10 px-4 text-sm",
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── CTA cuối ───────────────────────── */

function FinalCta({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-t border-line">
      {/* Lặp lại gradient wash ở cuối trang — Attio cũng khép trang bằng wash này */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 90% at 50% 100%, var(--landing-wash) 0%, transparent 70%)",
        }}
      />
      <Reveal className="relative mx-auto max-w-[1120px] px-5 py-24 text-center sm:px-8">
        <h2 className="mx-auto max-w-xl font-sans text-[32px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[42px]">
          Your customers are asking.
          <br />
          Let your documents answer.
        </h2>
        <div className="mt-9">
          <Link
            to={loggedIn ? "/app" : "/register"}
            className={cn(darkBtn, "h-11 px-6 text-[15px]")}
          >
            {loggedIn ? "Open dashboard" : "Create your first chatbot — free"}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Chân trang ───────────────────────── */

const FOOTER_COLUMNS: {
  heading: string;
  links: { label: string; to?: string; href?: string }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Create account", to: "/register" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "hello@pengbot.vn", href: "mailto:hello@pengbot.vn" },
      { label: "Terms of use", href: "#" },
      { label: "Privacy policy", href: "#" },
    ],
  },
];

function SiteFooter() {
  // Footer ĐEN cố định ở cả hai theme — như footer của Attio.
  return (
    <footer className="bg-[#0A0D0C] text-[#98A19E]">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8">
        <div className="flex flex-col justify-between gap-12 md:flex-row">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="font-sans text-[19px] font-bold tracking-tight text-white">
                Pengbot
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed">
              The customer-support chatbot that learns from your company
              documents. Built in Vietnam.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <div className="font-mono text-[11px] tracking-[0.14em] text-[#5C6663] uppercase">
                  {column.heading}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link
                          to={link.to}
                          className="text-[13px] transition-colors duration-150 hover:text-white"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-[13px] transition-colors duration-150 hover:text-white"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 border-t border-white/10 pt-6 text-[12px] text-[#5C6663]">
          © 2026 Pengbot. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
