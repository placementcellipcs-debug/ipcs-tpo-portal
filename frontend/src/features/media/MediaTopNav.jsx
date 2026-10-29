import { PaintBrush, Sparkle } from '@phosphor-icons/react';

export default function MediaTopNav({ title, subtitle, pendingCount = 0, publishedCount = 0 }) {
  return <header className="media-studio-hero">
    <div className="media-studio-hero-copy">
      <span className="media-studio-eyebrow"><i /> IPCS CREATIVE WORKSPACE</span>
      <h1><PaintBrush weight="duotone" /> {title}</h1>
      <p>{subtitle}</p>
    </div>
    <div className="media-studio-stats" aria-label="Studio overview counts">
      <div className="media-studio-stat"><span>Active tasks</span><b>{Number(pendingCount || 0).toLocaleString('en-IN')}</b></div>
      <div className="media-studio-stat published"><span>Social posts</span><b>{Number(publishedCount || 0).toLocaleString('en-IN')}</b></div>
      <div className="media-studio-stat studio"><span>Studio</span><b><Sparkle size={19} weight="fill" /></b></div>
    </div>
  </header>;
}
