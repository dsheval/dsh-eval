'use client';

import { useRef, useState, type ReactNode } from 'react';

type EvaluationCard = { id: string; label: string; content: ReactNode };

export default function EvaluationCarousel({ cards }: { cards: EvaluationCard[] }) {
  const [active, setActive] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const turn = (step: number) => setActive(current => (current + step + cards.length) % cards.length);

  return <div className="evaluation-carousel" role="region" aria-roledescription="轮播" aria-label="已公开的评测">
    <div className="evaluation-carousel-controls">
      <div className="evaluation-carousel-labels" role="group" aria-label="选择评测">
        {cards.map((card, index) => <button key={card.id} type="button" aria-pressed={active === index} aria-controls={`evaluation-card-${card.id}`} onClick={() => setActive(index)}>{card.label}</button>)}
      </div>
      <div className="evaluation-carousel-pagination">
        <span aria-live="polite" aria-atomic="true">{active + 1} / {cards.length}</span>
        <button type="button" aria-label="上一份评测" onClick={() => turn(-1)}>←</button>
        <button type="button" aria-label="下一份评测" onClick={() => turn(1)}>→</button>
      </div>
    </div>
    <div className="homepage-evidence-shell evaluation-carousel-stage"
      onPointerDown={event => {
        if (event.pointerType !== 'touch' || (event.target as HTMLElement).closest('a, button')) return;
        gesture.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerCancel={() => { gesture.current = null; }}
      onPointerUp={event => {
        const start = gesture.current;
        gesture.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
      }}>
      {cards.map((card, index) => <div key={card.id} id={`evaluation-card-${card.id}`} className="evaluation-carousel-card" data-active={active === index} inert={active !== index} aria-hidden={active !== index} role="group" aria-roledescription="卡片" aria-label={`${index + 1} / ${cards.length} · ${card.label}`}>
        {card.content}
      </div>)}
    </div>
  </div>;
}
