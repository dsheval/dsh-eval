import { Fragment, type ReactNode } from 'react';

type InnerPageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  breadcrumbs?: ReadonlyArray<{ label: string; href?: string }>;
};

export function InnerPageHero({ eyebrow, title, description, actions, breadcrumbs }: InnerPageHeroProps) {
  return (
    <header className="inner-page-hero">
      {breadcrumbs && (
        <nav className="inner-page-breadcrumbs" aria-label="面包屑">
          <ol>
            {breadcrumbs.map(({ label, href }) => (
              <li key={label}>
                {href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="inner-page-hero-content">
        <p className="inner-page-hero-eyebrow" data-site-label="page" lang="en">
          {eyebrow.split(' · ').map((part, index) => (
            <Fragment key={part}>{index > 0 ? ' · ' : null}<span>{part}</span></Fragment>
          ))}
        </p>
        <h1 data-site-title="page">{title}</h1>
        <div className="inner-page-hero-summary">
          <p data-site-copy="lead">{description}</p>
          {actions}
        </div>
      </div>
    </header>
  );
}
