"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./home-banner-slider.module.css";
import { shuffleBannerIds } from "@/lib/banner-order";

// TOPページ「開催予定のトーナメント・イベント」直上のバナースライダー
// (2026/10追加)。表示する行は総合管理画面 > バナー管理で position='top'
// として登録したもの(lib/banners.ts の getTopBanners で取得)。
// 1件なら静止表示、2件以上で5秒ごとの自動切替・ドット・
// スワイプ(横スクロールのscroll-snap)に対応する。ホバー/フォーカス/
// タッチ中と prefers-reduced-motion のときは自動切替しない。

export type HomeBanner = {
  device?: "all" | "pc" | "mobile";
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  external: boolean;
};

const INTERVAL_MS = 5000;

// 表示・クリック計測。sendBeaconならクリック直後に画面遷移しても送信が
// 途中で捨てられない。失敗しても表示・遷移は止めない。
function track(type: "impression" | "click", bannerId: string) {
  try {
    const body = JSON.stringify({ type, bannerId });
    if (navigator.sendBeacon?.("/api/banners/track", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/banners/track", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 計測失敗は無視する
  }
}

function BannerImage({ banner, index, clone = false }: { banner: HomeBanner; index: number; clone?: boolean }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.image_url}
      alt={clone ? "" : banner.title}
      width={1200}
      height={400}
      loading={index === 0 ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
  if (!banner.link_url) return img;
  return (
    <a
      href={banner.link_url}
      tabIndex={clone ? -1 : undefined}
      {...(banner.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={() => track("click", banner.id)}
    >
      {img}
    </a>
  );
}

export function HomeBannerSlider({ banners }: { banners: HomeBanner[] }) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetFrame = useRef<number | null>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const count = banners.length;
  const bannerKey = JSON.stringify(banners.map(b => b.id));
  const [order, setOrder] = useState<string[]>([]);
  const ready = count < 2 || (order.length === count && banners.every(b => order.includes(b.id)));
  const slides = ready && count > 1 ? order.map(id => banners.find(b => b.id === id)!) : banners;

  const renderedSlides = count > 1
    ? [{ banner: slides[count - 1], clone: true, key: "tail-clone" },
       ...slides.map(banner => ({ banner, clone: false, key: banner.id })),
       { banner: slides[0], clone: true, key: "head-clone" }]
    : slides.map(banner => ({ banner, clone: false, key: banner.id }));

  // A copy at either edge lets the last slide move left to the first slide.
  // Reposition to the identical real slide only after scrolling has settled.
  const jumpTo = useCallback((physical: number) => {
    const el = trackRef.current;
    if (!el) return;
    if (resetFrame.current != null) cancelAnimationFrame(resetFrame.current);
    el.style.scrollSnapType = "none";
    el.scrollTo({ left: physical * el.clientWidth, behavior: "instant" as ScrollBehavior });
    resetFrame.current = requestAnimationFrame(() => {
      el.style.scrollSnapType = "";
      resetFrame.current = null;
    });
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    setIndex(0);
    jumpTo(count > 1 ? 1 : 0);
    let width = trackRef.current?.clientWidth;
    const observer = new ResizeObserver(() => {
      const nextWidth = trackRef.current?.clientWidth;
      if (width !== nextWidth) {
        width = nextWidth;
        jumpTo(count > 1 ? indexRef.current + 1 : 0);
      }
    });
    if (trackRef.current) observer.observe(trackRef.current);
    return () => {
      observer.disconnect();
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (resetFrame.current != null) cancelAnimationFrame(resetFrame.current);
    };
  }, [ready, bannerKey, count, jumpTo]);

  // Shuffle on each browser mount, not on the server where a cached order would
  // be shared by all visitors. Keep the reserved slot hidden until ready so the
  // first banner and impression are random too.
  useEffect(() => {
    setOrder(shuffleBannerIds(JSON.parse(bannerKey)));
    setIndex(0);

  }, [bannerKey]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // 画面内に半分以上見えているときだけ「表示」とみなす(計測・自動切替)。
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 各バナーが初めて表示されたときに1回だけbanner_impressionsへ記録する。
  useEffect(() => {
    if (!visible || !ready) return;
    const banner = slides[index];
    if (banner && !seen.current.has(banner.id)) {
      seen.current.add(banner.id);
      track("impression", banner.id);
    }
  }, [visible, ready, index, slides]);

  const goTo = useCallback(
    (target: number) => {
      const el = trackRef.current;
      if (!el || count === 0) return;
      const next = (target + count) % count;
      const physical = target === count ? count + 1 : next + 1;
      el.scrollTo({ left: physical * el.clientWidth, behavior: reducedMotion ? "instant" as ScrollBehavior : "smooth" });
    },
    [count, reducedMotion]
  );

  // スワイプ(横スクロール)後に、いま表示されているスライド番号へ合わせる。
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const physical = Math.round(el.scrollLeft / el.clientWidth);
    const current = ((physical - 1) % count + count) % count;
    if (current !== index) setIndex(current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const position = Math.round(el.scrollLeft / el.clientWidth);
      if (position === 0) jumpTo(count);
      else if (position === count + 1) jumpTo(1);
    }, 160);
  };

  const paused = hovered || focused || touching;
  useEffect(() => {
    if (count < 2 || !ready || paused || reducedMotion || !visible) return;
    const timer = window.setTimeout(() => goTo(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [count, ready, paused, reducedMotion, visible, index, goTo]);

  if (count === 0) return null;

  return (
    <section
      ref={rootRef}
      className={styles.slider}
      style={{ visibility: ready ? "visible" : "hidden" }}
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label="おすすめ"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // キーボード操作でのフォーカス中だけ止める。ドットをマウスで
      // クリックした後もフォーカスが残るため、それでは止めない。
      onFocus={(e) => {
        try {
          if (e.target.matches(":focus-visible")) setFocused(true);
        } catch {
          setFocused(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
    >
      <div ref={trackRef} className={styles.track} onScroll={count > 1 ? onScroll : undefined}>
        {renderedSlides.map(({ banner: b, clone, key }, i) => (
          <div
            key={key}
            aria-hidden={clone ? true : undefined}
            className={styles.slide}
            role={!clone && count > 1 ? "group" : undefined}
            aria-roledescription={!clone && count > 1 ? "slide" : undefined}
            aria-label={!clone && count > 1 ? `${i} / ${count}` : undefined}
          >
            <BannerImage banner={b} index={count > 1 ? i - 1 : i} clone={clone} />
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <div className={styles.dots}>
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                aria-label={`${i + 1}枚目のバナーを表示`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
