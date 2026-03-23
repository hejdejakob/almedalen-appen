'use client';

import { useState, useEffect } from 'react';

// --- Types ---

interface SpeakerEntry {
  id: number;
  name: string;
  title: string | null;
  org_name: string | null;
  totalPanels: number;
  years: number[];
  uniqueArrangers: number;
  breadth: number;
  topTopics: { topic: string; count: number }[];
  minYear: number;
  maxYear: number;
}

interface SpeakerGuideData {
  rising_stars: SpeakerEntry[];
  evergreens: SpeakerEntry[];
  high_breadth: SpeakerEntry[];
}

// --- Constants ---

const ALL_YEARS = [2022, 2023, 2024, 2025];

const TOPICS = [
  'arbetsmarknad_löner',
  'välfärd_omsorg',
  'hälsa_sjukvård',
  'skola_utbildning_forskning',
  'klimat_miljö_hållbarhet',
  'energi',
  'bostäder_samhällsbyggnad',
  'transport_infrastruktur',
  'ekonomi_tillväxt',
  'skatter_offentliga_finanser',
  'näringsliv_innovation',
  'digitalisering_ai',
  'försvar_säkerhet',
  'demokrati_rättsstat',
  'integration_migration',
  'eu_utrikespolitik',
  'jämställdhet_mångfald',
  'media_kommunikation',
  'kultur_idrott',
  'barn_ungdom',
  'övrigt',
];

const TOPIC_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#ff595e', '#8ac926',
];

function topicColor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = ((hash << 5) - hash) + topic.charCodeAt(i);
  return TOPIC_COLORS[Math.abs(hash) % TOPIC_COLORS.length];
}

function formatTopicLabel(topic: string): string {
  const label = topic.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type TabKey = 'rising_stars' | 'evergreens' | 'high_breadth';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'rising_stars', label: 'Rising Stars' },
  { key: 'evergreens', label: 'Evergreens' },
  { key: 'high_breadth', label: 'Hög Bredd' },
];

// --- Sub-components ---

function YearDots({ activeYears }: { activeYears: number[] }) {
  const activeSet = new Set(activeYears);
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {ALL_YEARS.map(y => (
        <span
          key={y}
          title={String(y)}
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: activeSet.has(y) ? '#ff6632' : 'transparent',
            border: '1.5px solid ' + (activeSet.has(y) ? '#ff6632' : '#aaa'),
            flexShrink: 0,
          }}
        />
      ))}
    </span>
  );
}

function TopicPills({ topics }: { topics: { topic: string; count: number }[] }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
      {topics.map(({ topic }) => (
        <span
          key={topic}
          style={{
            backgroundColor: topicColor(topic),
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '2px 7px',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {formatTopicLabel(topic)}
        </span>
      ))}
    </span>
  );
}

function SpeakerCard({ speaker, tab }: { speaker: SpeakerEntry; tab: TabKey }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        padding: '1.1rem 1.25rem',
        marginBottom: '0.75rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        position: 'relative',
      }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        backgroundColor: tab === 'rising_stars' ? '#8ac926' : tab === 'evergreens' ? '#ff6632' : '#457b9d',
      }} />

      {/* Main content */}
      <div style={{ flex: 1, paddingLeft: '0.25rem' }}>
        {/* Name + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.15rem' }}>
          <span style={{ fontFamily: 'var(--headings)', fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase' }}>
            {speaker.name}
          </span>
          {tab === 'rising_stars' && (
            <span style={{
              backgroundColor: '#8ac926',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '2px 7px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}>
              Ny sedan {speaker.minYear}
            </span>
          )}
        </div>

        {/* Title + org */}
        {(speaker.title || speaker.org_name) && (
          <div style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.5rem', lineHeight: 1.4 }}>
            {[speaker.title, speaker.org_name].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          {/* Prominent stat per tab */}
          {tab === 'evergreens' && (
            <span style={{
              fontFamily: 'var(--headings)',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ff6632',
              lineHeight: 1,
            }}>
              {speaker.totalPanels}
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--body-text)', color: '#777', fontWeight: 400, marginLeft: '3px' }}>paneler</span>
            </span>
          )}
          {tab === 'high_breadth' && (
            <span style={{
              fontFamily: 'var(--headings)',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#457b9d',
              lineHeight: 1,
            }}>
              {speaker.uniqueArrangers}
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--body-text)', color: '#777', fontWeight: 400, marginLeft: '3px' }}>arrangörer</span>
            </span>
          )}

          {/* Standard stats */}
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            {tab !== 'evergreens' && <>{speaker.totalPanels} paneler · </>}
            {tab !== 'high_breadth' && <>{speaker.uniqueArrangers} unika arrangörer · </>}
            {speaker.years.length} år aktiv
          </span>

          {/* Year dots */}
          <YearDots activeYears={speaker.years} />
        </div>

        {/* Topic pills */}
        {speaker.topTopics.length > 0 && (
          <TopicPills topics={speaker.topTopics} />
        )}
      </div>
    </div>
  );
}

// --- Main page ---

export default function TalarkollenPage() {
  const [data, setData] = useState<SpeakerGuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('rising_stars');
  const [topicFilter, setTopicFilter] = useState<string>('');

  useEffect(() => {
    fetch('/api/dashboard?view=speaker-guide')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const speakers: SpeakerEntry[] = data ? data[activeTab] : [];

  const filtered = topicFilter
    ? speakers.filter(s => s.topTopics.some(t => t.topic === topicFilter))
    : speakers;

  return (
    <div style={{ backgroundColor: 'var(--rs-natur, #f7f5e4)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem 0',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>
          <a href="/" style={{ color: '#ff6632', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            ← Tillbaka
          </a>
          <h1 style={{
            fontFamily: 'var(--headings)',
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            margin: '0.5rem 0 0.25rem',
            letterSpacing: '-0.01em',
          }}>
            TALARKOLLEN
          </h1>
          <p style={{ margin: 0, fontSize: '1.1rem', color: '#ccc', fontWeight: 400 }}>
            Vem ska du ha på scen?
          </p>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {/* Intro */}
        <p style={{
          fontSize: '1.05rem',
          lineHeight: 1.7,
          marginBottom: '2rem',
          color: '#333',
        }}>
          Almedalens 16&nbsp;000+ talare har olika profiler. Vissa är evergreens som dyker upp varje år,
          andra är nya röster på väg upp. Här hittar du rätt panelist för ditt seminarium.
        </p>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid #ddd',
          marginBottom: '1.5rem',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? '#000' : '#666',
                borderBottom: activeTab === tab.key ? '3px solid #ff6632' : '3px solid transparent',
                marginBottom: '-2px',
                fontFamily: 'var(--body-text)',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1.25rem', marginTop: '-0.5rem' }}>
          {activeTab === 'rising_stars' && 'Talare som debuterade 2024 eller senare med minst 3 paneldeltaganden. Nya röster med momentum.'}
          {activeTab === 'evergreens' && 'Talare med minst 15 paneldeltaganden totalt. Almedalens mest erfarna panelister.'}
          {activeTab === 'high_breadth' && 'Talare med hög bredd — aktiva hos 5+ unika arrangörer, men under 15 paneler totalt. Eftersökta men inte överväldigande.'}
        </p>

        {/* Topic filter */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>
            Filtrera på ämne:
          </label>
          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value)}
            style={{
              fontSize: '0.875rem',
              padding: '0.4rem 0.75rem',
              border: '1.5px solid #ccc',
              backgroundColor: '#fff',
              color: '#000',
              cursor: 'pointer',
              fontFamily: 'var(--body-text)',
              minWidth: '220px',
            }}
          >
            <option value="">Alla ämnen</option>
            {TOPICS.map(t => (
              <option key={t} value={t}>{formatTopicLabel(t)}</option>
            ))}
          </select>
          {topicFilter && (
            <button
              onClick={() => setTopicFilter('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#ff6632',
                fontSize: '0.875rem',
                fontWeight: 600,
                padding: '0.4rem 0',
              }}
            >
              Rensa filter ×
            </button>
          )}
        </div>

        {/* Loading / error states */}
        {loading && (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: '#666', fontSize: '1rem' }}>
            Laddar talardata…
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            padding: '1rem',
            color: '#991b1b',
            fontSize: '0.9rem',
          }}>
            Kunde inte hämta data: {error}
          </div>
        )}

        {/* Speaker list */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div style={{ padding: '2rem 0', color: '#666', fontSize: '0.95rem' }}>
                {topicFilter
                  ? `Inga talare i denna kategori har "${formatTopicLabel(topicFilter)}" bland sina topikämnen.`
                  : 'Inga talare hittades.'}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
                  {filtered.length} talare{topicFilter ? ` med ämne "${formatTopicLabel(topicFilter)}"` : ''}
                </div>
                {filtered.map(speaker => (
                  <SpeakerCard key={speaker.id} speaker={speaker} tab={activeTab} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
