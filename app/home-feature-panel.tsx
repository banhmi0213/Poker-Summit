"use client";

import { useState } from "react";
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
  const index = Math.max(0, items.findIndex(item => item.id === selectedId));
  const selected = items[index];
  if (!selected) return null;
  const move = (offset: number) => setSelectedId(items[(index + offset + items.length) % items.length].id);
  return (
    <section className={styles.panel} aria-label="注目の大会・クーポン・お知らせ">
      <article className={styles.feature} aria-live="polite" aria-atomic="true">
        <div className={styles.visual}>
          <a href={selected.href} target={selected.external ? "_blank" : undefined} rel={selected.external ? "noopener noreferrer" : undefined}>
            <img src={selected.image} alt={selected.title} />
          </a>
          {items.length > 1 && <div className={styles.arrows}>
            <button type="button" onClick={() => move(-1)} aria-label="前の注目情報">‹</button>
            <button type="button" onClick={() => move(1)} aria-label="次の注目情報">›</button>
          </div>}
        </div>
        <div className={styles.caption}>
          <span className={styles.badge}>{selected.category}</span>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
          <a className={styles.detail} href={selected.href} target={selected.external ? "_blank" : undefined} rel={selected.external ? "noopener noreferrer" : undefined}>詳細を見る <span aria-hidden="true">›</span></a>
        </div>
      </article>
      <div className={styles.list} aria-label="表示する注目情報を選ぶ">
        {items.map(item => <button key={item.id} type="button" className={`${styles.item} ${item.id === selected.id ? styles.selected : ""}`} aria-pressed={item.id === selected.id} onClick={() => setSelectedId(item.id)}>
          <span className={styles.badge}>{item.category}</span>
          <strong>{item.title}</strong>
          <span className={styles.chevron} aria-hidden="true">›</span>
        </button>)}
      </div>
    </section>
  );
}
