"use client";

import { useEffect, useState } from "react";
import styles from "./home-feature-panel.module.css";

export type HomeFeatureItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  image: string;
  href: string;
  external?: boolean;
};

export function HomeFeaturePanel({ items }: { items: HomeFeatureItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const index = Math.max(0, items.findIndex(item => item.id === selectedId));
  const selected = items[index];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (items.length < 2 || hovered || focused || paused || reducedMotion || !visible) return;
    const timer = window.setTimeout(() => setSelectedId(items[(index + 1) % items.length].id), 6000);
    return () => window.clearTimeout(timer);
  }, [items, index, hovered, focused, paused, reducedMotion, visible]);

  if (!selected) return null;
  const move = (offset: number) => setSelectedId(items[(index + offset + items.length) % items.length].id);
  return (
    <section className={styles.panel} aria-label="Poker Summitのおすすめコンテンツ"
      onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
      <div className={styles.feature} aria-roledescription="カルーセル">
        <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {items.map((item, slideIndex) => {
            const active = slideIndex === index;
            return <article key={item.id} className={styles.slide} aria-hidden={!active} aria-label={`${slideIndex + 1} / ${items.length}`}>
              <div className={styles.visual}>
                <a tabIndex={active ? 0 : -1} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}>
                  <img src={item.image} alt={item.title} />
                </a>
                {items.length > 1 && <div className={styles.arrows}>
                  <button tabIndex={active ? 0 : -1} type="button" onClick={() => move(-1)} aria-label="前の注目情報">‹</button>
                  <button tabIndex={active ? 0 : -1} type="button" onClick={() => move(1)} aria-label="次の注目情報">›</button>
                </div>}
              </div>
              <div className={styles.caption}>
                <span className={styles.badge}>{item.category}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <a tabIndex={active ? 0 : -1} className={styles.detail} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined}>詳細を見る</a>
              </div>
            </article>;
          })}
        </div>
        {items.length > 1 && <button type="button" className={styles.playback} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "自動切替を再開" : "自動切替を停止"}</button>}
      </div>
      <div className={styles.list} aria-label="表示する注目情報を選ぶ">
        {items.map(item => <button key={item.id} type="button" className={`${styles.item} ${item.id === selected.id ? styles.selected : ""}`} aria-pressed={item.id === selected.id}
          onPointerEnter={event => { if (event.pointerType !== "touch") setSelectedId(item.id); }} onFocus={() => setSelectedId(item.id)} onClick={() => setSelectedId(item.id)}>
          <span className={styles.badge}>{item.category}</span>
          <strong>{item.title}</strong>
        </button>)}
      </div>
    </section>
  );
}
