'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

const CATEGORY_LABELS: Record<string, string> = {
  politiker: 'Politiker',
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  facklig: 'Facklig',
  arbetsgivar_branschorg: 'Arbetsgivar/bransch',
  civilsamhälle: 'Civilsamhälle',
  media: 'Media',
  akademi: 'Akademi',
  offentlig_sektor: 'Offentlig sektor',
};

const CATEGORY_COLORS: Record<string, string> = {
  politiker: '#1982c4',
  näringsliv: '#e63946',
  konsult_pr: '#457b9d',
  facklig: '#e9c46a',
  arbetsgivar_branschorg: '#2a9d8f',
  civilsamhälle: '#f4a261',
  media: '#ff595e',
  akademi: '#8ac926',
  offentlig_sektor: '#6a4c93',
};

const SECTOR_COLORS: Record<string, string> = {
  näringsliv: '#e63946',
  konsult_pr: '#457b9d',
  arbetsgivar_branschorg: '#2a9d8f',
  fackförbund: '#e9c46a',
  civilsamhälle: '#f4a261',
  tänketank_stiftelse: '#264653',
  offentlig_sektor: '#6a4c93',
  parti: '#1982c4',
  media: '#ff595e',
  akademi: '#8ac926',
};

function formatTopic(topic: string): string {
  const label = topic.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// --- Talarkollen types & constants ---

type TalarkollenEntry = {
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
};

type TalarkollenData = {
  rising_stars: TalarkollenEntry[];
  evergreens: TalarkollenEntry[];
  high_breadth: TalarkollenEntry[];
};

type TalarkollenTabKey = 'rising_stars' | 'evergreens' | 'high_breadth';

const TALARKOLLEN_ALL_YEARS = [2022, 2023, 2024, 2025];

const TALARKOLLEN_TOPICS = [
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

const TALARKOLLEN_TOPIC_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#ff595e', '#8ac926',
];

function talarkollenTopicColor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = ((hash << 5) - hash) + topic.charCodeAt(i);
  return TALARKOLLEN_TOPIC_COLORS[Math.abs(hash) % TALARKOLLEN_TOPIC_COLORS.length];
}

const TALARKOLLEN_TABS: { key: TalarkollenTabKey; label: string }[] = [
  { key: 'rising_stars', label: 'Rising Stars' },
  { key: 'evergreens', label: 'Evergreens' },
  { key: 'high_breadth', label: 'Hög Bredd' },
];

type SearchResult = {
  id: number;
  name: string;
  title: string | null;
  org: string | null;
  category: string | null;
  totalPanels: number;
  yearsActive: number;
};

type EventDetail = {
  event: {
    id: number;
    year: number;
    title: string;
    description: string | null;
    extended_description: string | null;
    start_time: string | null;
    end_time: string | null;
    day_of_week: string | null;
    location_name: string | null;
    lat: number | null;
    lng: number | null;
    event_type: string | null;
    url: string | null;
  };
  topic: { topic_primary: string | null; topic_secondary: string[] | null; keywords: string[] | null } | null;
  sentiment: { score: number; label: string; urgency_score: number; framing: string } | null;
  speakers: {
    id: number;
    name: string;
    title: string | null;
    org: string | null;
    category: string | null;
    role: string | null;
  }[];
  arrangers: {
    id: number;
    name: string;
    sector: string | null;
    isPrimary: boolean;
  }[];
};

type SpeakerProfile = {
  speaker: {
    id: number;
    name: string;
    title: string | null;
    org_name: string | null;
    category: string | null;
    first_seen_year: number | null;
  };
  stats: {
    totalPanels: number;
    yearsActive: number;
    uniqueArrangers: number;
    breadthScore: number;
    perYear: { year: number; panel_count: number; unique_arrangers: number; breadth_score: number }[];
  };
  seminars: {
    id: number;
    year: number;
    title: string;
    topic: string | null;
    arranger: string | null;
    arrangerSector: string | null;
  }[];
  coPanelists: {
    id: number;
    name: string;
    title: string | null;
    org: string | null;
    category: string | null;
    sharedCount: number;
  }[];
};

export default function SpeakersPage() {
  return (
    <Suspense fallback={<div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Laddar...</div>}>
      <SpeakersContent />
    </Suspense>
  );
}

function SpeakersContent() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get('id');
  const initialTab = searchParams.get('tab');

  const [mode, setMode] = useState<'search' | 'talarkollen' | 'amnen' | 'aktorer'>(() => {
    if (initialTab === 'talarkollen') return 'talarkollen';
    if (initialTab === 'amnen') return 'amnen';
    if (initialTab === 'aktorer') return 'aktorer';
    return 'search';
  });

  const [selectedTopic, setSelectedTopic] = useState<string | null>(searchParams.get('topic'));
  const [selectedArrangerId, setSelectedArrangerId] = useState<number | null>(
    initialTab === 'aktorer' && searchParams.get('id') ? parseInt(searchParams.get('id')!) : null
  );

  const switchMode = (m: 'search' | 'talarkollen' | 'amnen' | 'aktorer') => {
    setMode(m);
    if (m === 'talarkollen') router.replace('/speakers?tab=talarkollen', { scroll: false });
    else if (m === 'amnen') router.replace('/speakers?tab=amnen', { scroll: false });
    else if (m === 'aktorer') router.replace('/speakers?tab=aktorer', { scroll: false });
    else router.replace('/speakers', { scroll: false });
    setProfile(null);
    setEventDetail(null);
    if (m !== 'amnen') setSelectedTopic(null);
    if (m !== 'aktorer') setSelectedArrangerId(null);
  };

  const openTopic = (topic: string) => {
    setMode('amnen');
    setSelectedTopic(topic);
    router.replace(`/speakers?tab=amnen&topic=${topic}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArrangerProfile = (id: number) => {
    setMode('aktorer');
    setSelectedArrangerId(id);
    router.replace(`/speakers?tab=aktorer&id=${id}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SpeakerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load initial top speakers or profile
  useEffect(() => {
    if (initialId) {
      loadProfile(parseInt(initialId));
    } else {
      searchSpeakers('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchSpeakers = useCallback(async (q: string) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '30');
      const res = await fetch(`/api/speakers?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setResults(data.speakers || []);
        setLoading(false);
        setHasSearched(true);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setResults([]);
        setLoading(false);
        setHasSearched(true);
      }
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchSpeakers(value);
    }, 300);
  };

  const loadProfile = async (id: number) => {
    setProfileLoading(true);
    setProfile(null);
    setEventDetail(null);
    try {
      const res = await fetch(`/api/speakers?id=${id}`);
      const data = await res.json();
      setProfile(data);
    } catch {
      setProfile(null);
    }
    setProfileLoading(false);
    setSelectedYear(null);
  };

  const loadEvent = async (eventId: number) => {
    setEventLoading(true);
    setEventDetail(null);
    try {
      const res = await fetch(`/api/speakers?event=${eventId}`);
      const data = await res.json();
      setEventDetail(data);
    } catch {
      setEventDetail(null);
    }
    setEventLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBackFromEvent = () => {
    setEventDetail(null);
  };

  const goBack = () => {
    if (eventDetail) {
      setEventDetail(null);
      return;
    }
    setProfile(null);
    if (mode === 'talarkollen') router.replace('/speakers?tab=talarkollen', { scroll: false });
    else if (mode === 'amnen') router.replace('/speakers?tab=amnen', { scroll: false });
    else if (mode === 'aktorer') router.replace('/speakers?tab=aktorer', { scroll: false });
    else router.replace('/speakers', { scroll: false });
    if (mode === 'search' && !hasSearched) searchSpeakers('');
  };

  const openProfile = (id: number) => {
    setEventDetail(null);
    router.replace(`/speakers?id=${id}`, { scroll: false });
    loadProfile(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: isMobile ? '1.25rem 0' : '2rem 0',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '0 1rem' : '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>
              {mode === 'talarkollen' ? 'TALARKOLLEN' : mode === 'amnen' ? 'ÄMNESSÖK' : mode === 'aktorer' ? 'AKTÖRSSÖK' : 'TALARSÖK'}
            </h1>
            {!isMobile && (
              <p style={{ fontSize: '1rem', opacity: 0.7, marginTop: '0.5rem' }}>
                {mode === 'talarkollen' ? 'Vem ska du ha på scen?' : mode === 'amnen' ? 'Vad pratar Almedalen om?' : mode === 'aktorer' ? 'Vem gör vad i Almedalen?' : 'Sök bland 16 509 paneldeltagare från Almedalsveckan 2022–2025'}
              </p>
            )}
          </div>
          <a href="/" style={{
            color: '#ff6632',
            textDecoration: 'none',
            fontSize: isMobile ? '0.8rem' : '0.9rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            ← Dashboard
          </a>
        </div>
      </header>

      {!profile && !eventDetail && (
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: isMobile ? '0.75rem 1rem 0' : '1rem 2rem 0',
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid #ddd',
          backgroundColor: '#f7f5e4',
          overflowX: 'auto',
        }}>
          {([
            { key: 'search' as const, label: 'Talarsök' },
            { key: 'talarkollen' as const, label: 'Talarkollen' },
            { key: 'amnen' as const, label: 'Ämnessök' },
            { key: 'aktorer' as const, label: 'Aktörssök' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => switchMode(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: mode === tab.key ? 700 : 500,
                color: mode === tab.key ? '#000' : '#666',
                borderBottom: mode === tab.key ? '3px solid #ff6632' : '3px solid transparent',
                marginBottom: '-2px',
                fontFamily: 'var(--body-text)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>
        {eventDetail ? (
          <EventDetailView
            detail={eventDetail}
            loading={eventLoading}
            onBack={goBackFromEvent}
            onOpenProfile={openProfile}
            onOpenEvent={loadEvent}
          />
        ) : profile ? (
          <ProfileView
            profile={profile}
            loading={profileLoading}
            onBack={goBack}
            onOpenProfile={openProfile}
            onOpenEvent={loadEvent}
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
          />
        ) : (
          <>
            {mode === 'search' && (
              <>
                {/* Search field */}
                <div style={{ marginBottom: '2rem', maxWidth: '700px', margin: '0 auto 2rem' }}>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Sök bland 16 509 paneldeltagare..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                      fontSize: isMobile ? '1rem' : '1.3rem',
                      border: isMobile ? '2px solid #000' : '3px solid #000',
                      borderRadius: '8px',
                      fontFamily: 'inherit',
                      backgroundColor: '#fff',
                      boxShadow: isMobile ? '2px 2px 0 #000' : '4px 4px 0 #000',
                      outline: 'none',
                    }}
                  />
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Söker...</div>
                ) : (
                  <>
                    {!query.trim() && results.length > 0 && (
                      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Mest aktiva paneldeltagare
                      </p>
                    )}
                    {query.trim() && results.length === 0 && hasSearched && (
                      <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                        Inga träffar för &quot;{query}&quot;
                      </p>
                    )}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
                      gap: '1rem',
                    }}>
                      {results.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => openProfile(s.id)}
                          style={{
                            backgroundColor: '#fff',
                            padding: '1.25rem',
                            borderRadius: '8px',
                            border: '2px solid #000',
                            boxShadow: '3px 3px 0 #000',
                            cursor: 'pointer',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translate(-2px, -2px)';
                            e.currentTarget.style.boxShadow = '5px 5px 0 #000';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = '3px 3px 0 #000';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.name}</div>
                            <span style={{
                              backgroundColor: '#ff6632',
                              color: '#fff',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              marginLeft: '0.5rem',
                            }}>
                              {s.totalPanels} paneler
                            </span>
                          </div>
                          {s.title && (
                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>{s.title}</div>
                          )}
                          {s.org && (
                            <div style={{ fontSize: '0.85rem', color: '#444', marginBottom: '0.5rem' }}>{s.org}</div>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {s.category && (
                              <span style={{
                                backgroundColor: CATEGORY_COLORS[s.category] || '#ccc',
                                color: '#fff',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                              }}>
                                {CATEGORY_LABELS[s.category] || s.category}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#999' }}>
                              {s.yearsActive} år aktiv
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {mode === 'talarkollen' && (
              <TalarkollenTab onOpenProfile={openProfile} />
            )}
            {mode === 'amnen' && (
              <AmnesTab
                onOpenProfile={openProfile}
                onOpenArrangerProfile={openArrangerProfile}
                selectedTopic={selectedTopic}
                onSelectTopic={(t) => {
                  setSelectedTopic(t);
                  if (t) router.replace(`/speakers?tab=amnen&topic=${t}`, { scroll: false });
                  else router.replace('/speakers?tab=amnen', { scroll: false });
                }}
              />
            )}
            {mode === 'aktorer' && (
              <AktorerTab
                onOpenProfile={openProfile}
                onOpenTopic={openTopic}
                selectedArrangerId={selectedArrangerId}
                onSelectArrangerId={(id) => {
                  setSelectedArrangerId(id);
                  if (id) router.replace(`/speakers?tab=aktorer&id=${id}`, { scroll: false });
                  else router.replace('/speakers?tab=aktorer', { scroll: false });
                }}
              />
            )}
          </>
        )}
      </main>

      <footer style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem 0',
        textAlign: 'center',
        fontSize: '0.85rem',
        opacity: 0.7,
        marginTop: '3rem',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          Reform Society | Almedalsdata 2022–2026
        </div>
      </footer>
    </div>
  );
}

// --- Talarkollen sub-components ---

function TalarkollenYearDots({ activeYears }: { activeYears: number[] }) {
  const activeSet = new Set(activeYears);
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {TALARKOLLEN_ALL_YEARS.map(y => (
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

function TalarkollenTopicPills({ topics }: { topics: { topic: string; count: number }[] }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
      {topics.map(({ topic }) => (
        <span
          key={topic}
          style={{
            backgroundColor: talarkollenTopicColor(topic),
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '2px 7px',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {formatTopic(topic)}
        </span>
      ))}
    </span>
  );
}

function TalarkollenSpeakerCard({ speaker, tab, onOpenProfile }: { speaker: TalarkollenEntry; tab: TalarkollenTabKey; onOpenProfile: (id: number) => void }) {
  return (
    <div
      onClick={() => onOpenProfile(speaker.id)}
      style={{
        backgroundColor: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
        padding: '1.1rem 1.25rem',
        marginBottom: '0.75rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        position: 'relative',
        cursor: 'pointer',
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
          <TalarkollenYearDots activeYears={speaker.years} />
        </div>

        {/* Topic pills */}
        {speaker.topTopics.length > 0 && (
          <TalarkollenTopicPills topics={speaker.topTopics} />
        )}
      </div>
    </div>
  );
}

// --- TalarkollenTab main component ---

function TalarkollenTab({ onOpenProfile }: { onOpenProfile: (id: number) => void }) {
  const [data, setData] = useState<TalarkollenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TalarkollenTabKey>('rising_stars');
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

  const speakers: TalarkollenEntry[] = data ? data[activeTab] : [];

  const filtered = topicFilter
    ? speakers.filter(s => s.topTopics.some(t => t.topic === topicFilter))
    : speakers;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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

      {/* Sub-tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '2px solid #ddd',
        marginBottom: '1.5rem',
      }}>
        {TALARKOLLEN_TABS.map(tab => (
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
          {TALARKOLLEN_TOPICS.map(t => (
            <option key={t} value={t}>{formatTopic(t)}</option>
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
            Rensa filter x
          </button>
        )}
      </div>

      {/* Loading / error states */}
      {loading && (
        <div style={{ padding: '3rem 0', textAlign: 'center', color: '#666', fontSize: '1rem' }}>
          Laddar talardata...
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
          Kunde inte hamta data: {error}
        </div>
      )}

      {/* Speaker list */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem 0', color: '#666', fontSize: '0.95rem' }}>
              {topicFilter
                ? `Inga talare i denna kategori har "${formatTopic(topicFilter)}" bland sina topikamnen.`
                : 'Inga talare hittades.'}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
                {filtered.length} talare{topicFilter ? ` med amne "${formatTopic(topicFilter)}"` : ''}
              </div>
              {filtered.map(speaker => (
                <TalarkollenSpeakerCard key={speaker.id} speaker={speaker} tab={activeTab} onOpenProfile={onOpenProfile} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileView({
  profile,
  loading,
  onBack,
  onOpenProfile,
  onOpenEvent,
  selectedYear,
  onSelectYear,
}: {
  profile: SpeakerProfile | null;
  loading: boolean;
  onBack: () => void;
  onOpenProfile: (id: number) => void;
  onOpenEvent: (eventId: number) => void;
  selectedYear: number | null;
  onSelectYear: (y: number | null) => void;
}) {
  if (loading || !profile) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Laddar profil...</div>;
  }

  const { speaker, stats, seminars, coPanelists } = profile;
  const years = [2022, 2023, 2024, 2025];
  const maxPanels = Math.max(...stats.perYear.map(s => s.panel_count), 1);
  const filteredSeminars = selectedYear
    ? seminars.filter(s => s.year === selectedYear)
    : seminars;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#ff6632',
          fontWeight: 600,
          fontSize: '0.95rem',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '1.5rem',
        }}
      >
        ← Tillbaka till sökning
      </button>

      {/* Header + stats */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '8px',
        border: '2px solid #000',
        boxShadow: '4px 4px 0 #000',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', margin: 0 }}>
            {speaker.name}
          </h2>
          {speaker.category && (
            <span style={{
              backgroundColor: CATEGORY_COLORS[speaker.category] || '#ccc',
              color: '#fff',
              padding: '0.2rem 0.7rem',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}>
              {CATEGORY_LABELS[speaker.category] || speaker.category}
            </span>
          )}
        </div>
        {(speaker.title || speaker.org_name) && (
          <p style={{ color: '#555', margin: '0 0 1.5rem', fontSize: '1.05rem' }}>
            {[speaker.title, speaker.org_name].filter(Boolean).join(' — ')}
          </p>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Paneler totalt', value: stats.totalPanels },
            { label: 'År aktiv', value: stats.yearsActive },
            { label: 'Unika arrangörer', value: stats.uniqueArrangers },
            { label: 'Breddpoäng', value: stats.breadthScore.toFixed(1) },
          ].map(item => (
            <div key={item.label} style={{
              backgroundColor: '#f7f5e4',
              padding: '1rem',
              borderRadius: '6px',
              textAlign: 'center',
              border: '1px solid #e0dcc8',
            }}>
              <div style={{ fontFamily: 'var(--font-formula)', fontSize: '1.8rem', color: '#ff6632', fontWeight: 700 }}>
                {item.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Sparkline */}
        {stats.perYear.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Paneler per år
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
              {years.map(year => {
                const ys = stats.perYear.find(s => s.year === year);
                const count = ys?.panel_count || 0;
                const height = count > 0 ? (count / maxPanels) * 100 : 0;
                return (
                  <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
                      {count > 0 ? count : ''}
                    </div>
                    <div style={{
                      width: '100%',
                      height: `${Math.max(height * 0.5, count > 0 ? 4 : 0)}px`,
                      backgroundColor: count > 0 ? '#ff6632' : '#e0dcc8',
                      borderRadius: '2px 2px 0 0',
                      minHeight: count > 0 ? '4px' : '2px',
                    }} />
                    <div style={{ fontSize: '0.65rem', color: '#999', marginTop: '3px' }}>{year}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Seminars */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '8px',
        border: '2px solid #000',
        boxShadow: '4px 4px 0 #000',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
          SEMINARIER ({seminars.length})
        </h3>

        {/* Year filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectYear(null)}
            style={{
              padding: '0.3rem 0.7rem',
              border: '2px solid #000',
              borderRadius: '16px',
              backgroundColor: selectedYear === null ? '#000' : '#fff',
              color: selectedYear === null ? '#fff' : '#000',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Alla
          </button>
          {years.map(y => {
            const count = seminars.filter(s => s.year === y).length;
            if (count === 0) return null;
            return (
              <button
                key={y}
                onClick={() => onSelectYear(selectedYear === y ? null : y)}
                style={{
                  padding: '0.3rem 0.7rem',
                  border: '2px solid #000',
                  borderRadius: '16px',
                  backgroundColor: selectedYear === y ? '#000' : '#fff',
                  color: selectedYear === y ? '#fff' : '#000',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {y} ({count})
              </button>
            );
          })}
        </div>

        {filteredSeminars.length === 0 ? (
          <p style={{ color: '#999' }}>Inga seminarier för valt år.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>År</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 700 }}>Titel</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 700 }}>Ämne</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 700 }}>Arrangör</th>
                </tr>
              </thead>
              <tbody>
                {filteredSeminars.map((s, i) => (
                  <tr key={`${s.id}-${i}`} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.year}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span
                        onClick={() => onOpenEvent(s.id)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #ccc' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6632'; e.currentTarget.style.borderColor = '#ff6632'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.borderColor = '#ccc'; }}
                      >
                        {s.title}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {s.topic && (
                        <span style={{
                          backgroundColor: '#f0ede0',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatTopic(s.topic)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', color: '#555' }}>
                      {s.arranger && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {s.arrangerSector && (
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: SECTOR_COLORS[s.arrangerSector] || '#ccc',
                              display: 'inline-block',
                              flexShrink: 0,
                            }} />
                          )}
                          {s.arranger}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Co-panelists */}
      {coPanelists.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          border: '2px solid #000',
          boxShadow: '4px 4px 0 #000',
        }}>
          <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
            MEDPANELISTER
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            Personer som delat minst 2 seminarier med {speaker.name}.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {coPanelists.map((cp) => (
              <div
                key={cp.id}
                onClick={() => onOpenProfile(cp.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f7f5e4',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #e0dcc8',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
              >
                <div>
                  <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{cp.name}</span>
                  {cp.category && (
                    <span style={{
                      backgroundColor: CATEGORY_COLORS[cp.category] || '#ccc',
                      color: '#fff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '8px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                    }}>
                      {CATEGORY_LABELS[cp.category] || cp.category}
                    </span>
                  )}
                  {(cp.title || cp.org) && (
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                      {[cp.title, cp.org].filter(Boolean).join(' — ')}
                    </div>
                  )}
                </div>
                <span style={{
                  backgroundColor: '#ff6632',
                  color: '#fff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>
                  {cp.sharedCount} gemensamma
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  positiv: '#2a9d8f',
  neutral: '#999',
  negativ: '#e63946',
};

const FRAMING_LABELS: Record<string, string> = {
  problem: 'Problemfokus',
  solution: 'Lösningsfokus',
  neutral: 'Neutral',
};

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function EventDetailView({
  detail,
  loading,
  onBack,
  onOpenProfile,
  onOpenEvent,
}: {
  detail: EventDetail | null;
  loading: boolean;
  onBack: () => void;
  onOpenProfile: (id: number) => void;
  onOpenEvent: (eventId: number) => void;
}) {
  if (loading || !detail) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Laddar seminarium...</div>;
  }

  const { event, topic, sentiment, speakers, arrangers } = detail;
  const panelists = speakers.filter(s => s.role !== 'kontaktperson');
  const contacts = speakers.filter(s => s.role === 'kontaktperson');

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#ff6632',
          fontWeight: 600,
          fontSize: '0.95rem',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '1.5rem',
        }}
      >
        ← Tillbaka
      </button>

      {/* Event header */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '8px',
        border: '2px solid #000',
        boxShadow: '4px 4px 0 #000',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{
            backgroundColor: '#000',
            color: '#fff',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}>
            {event.year}
          </span>
          {event.event_type && (
            <span style={{
              backgroundColor: '#f0ede0',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {event.event_type}
            </span>
          )}
          {topic?.topic_primary && (
            <span style={{
              backgroundColor: '#f0ede0',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
            }}>
              {formatTopic(topic.topic_primary)}
            </span>
          )}
        </div>

        <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.3rem, 3vw, 2rem)', margin: '0 0 1rem' }}>
          {event.title}
        </h2>

        {event.description && (
          <p style={{ color: '#333', fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
            {event.description}
          </p>
        )}
        {event.extended_description && (
          <p style={{ color: '#666', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            {event.extended_description}
          </p>
        )}

        {/* Meta info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: sentiment ? '1.5rem' : 0 }}>
          {event.start_time && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Tid</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {formatDateTime(event.start_time)}
                {event.end_time && ` – ${formatTime(event.end_time)}`}
              </div>
            </div>
          )}
          {event.location_name && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Plats</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{event.location_name}</div>
            </div>
          )}
          {arrangers.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                {arrangers.length === 1 ? 'Arrangör' : 'Arrangörer'}
              </div>
              {arrangers.map(a => (
                <div key={a.id} style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {a.sector && (
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: SECTOR_COLORS[a.sector] || '#ccc',
                      display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                  {a.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sentiment */}
        {sentiment && (
          <div style={{
            display: 'flex', gap: '1rem', flexWrap: 'wrap',
            padding: '1rem',
            backgroundColor: '#f7f5e4',
            borderRadius: '6px',
            border: '1px solid #e0dcc8',
          }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentiment </span>
              <span style={{
                color: SENTIMENT_COLORS[sentiment.label] || '#999',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}>
                {sentiment.label} ({sentiment.score > 0 ? '+' : ''}{sentiment.score.toFixed(2)})
              </span>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Framing </span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{FRAMING_LABELS[sentiment.framing] || sentiment.framing}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Brådska </span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{(sentiment.urgency_score * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Source URL */}
        {event.url && (
          <div style={{ marginTop: '1rem' }}>
            <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff6632', fontSize: '0.85rem', fontWeight: 600 }}>
              Visa på almedalsveckan.info →
            </a>
          </div>
        )}
      </div>

      {/* Speakers */}
      {panelists.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          border: '2px solid #000',
          boxShadow: '4px 4px 0 #000',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
            MEDVERKANDE ({panelists.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {panelists.map((sp) => (
              <div
                key={sp.id}
                onClick={() => onOpenProfile(sp.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f7f5e4',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #e0dcc8',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
              >
                <div>
                  <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{sp.name}</span>
                  {sp.category && (
                    <span style={{
                      backgroundColor: CATEGORY_COLORS[sp.category] || '#ccc',
                      color: '#fff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '8px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                    }}>
                      {CATEGORY_LABELS[sp.category] || sp.category}
                    </span>
                  )}
                  {(sp.title || sp.org) && (
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                      {[sp.title, sp.org].filter(Boolean).join(' — ')}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#999' }}>Visa profil →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact persons */}
      {contacts.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem 2rem',
          borderRadius: '8px',
          border: '2px solid #000',
          boxShadow: '4px 4px 0 #000',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1rem', margin: '0 0 0.75rem', color: '#666' }}>
            KONTAKTPERSONER
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {contacts.map((sp) => (
              <div
                key={sp.id}
                onClick={() => onOpenProfile(sp.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#faf9f2',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0ede0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#faf9f2'; }}
              >
                <span style={{ fontWeight: 600 }}>{sp.name}</span>
                {sp.org && <span style={{ color: '#888' }}>— {sp.org}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary topics / keywords */}
      {topic && ((topic.topic_secondary && topic.topic_secondary.length > 0) || (topic.keywords && topic.keywords.length > 0)) && (
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem 2rem',
          borderRadius: '8px',
          border: '2px solid #000',
          boxShadow: '4px 4px 0 #000',
        }}>
          {topic.topic_secondary && topic.topic_secondary.length > 0 && (
            <div style={{ marginBottom: topic.keywords && topic.keywords.length > 0 ? '1rem' : 0 }}>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Sekundära ämnen
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {topic.topic_secondary.map((t, i) => (
                  <span key={i} style={{ backgroundColor: '#f0ede0', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                    {formatTopic(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {topic.keywords && topic.keywords.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Nyckelord
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {topic.keywords.map((k, i) => (
                  <span key={i} style={{ backgroundColor: '#eee', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.75rem', color: '#555' }}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- AmnesTab ---

type TopicListItem = {
  topic: string;
  totalEvents: number;
  latestYoY: number | null;
  avgSentiment: number;
  years: { year: number; event_count: number }[];
};

type TopicDetailData = {
  topic: string;
  totalEvents: number;
  perYear: { year: number; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; eventCount: number }[];
  topArrangers: { id: number; name: string; sector: string | null; eventCount: number }[];
  sectorBreakdown: { sector: string; count: number }[];
};

const SECTOR_LABELS: Record<string, string> = {
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  arbetsgivar_branschorg: 'Arbetsgivar/bransch',
  fackförbund: 'Fackförbund',
  civilsamhälle: 'Civilsamhälle',
  tänketank_stiftelse: 'Tänketank/stiftelse',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

function AmnesTab({
  onOpenProfile,
  onOpenArrangerProfile,
  selectedTopic,
  onSelectTopic,
}: {
  onOpenProfile: (id: number) => void;
  onOpenArrangerProfile: (id: number) => void;
  selectedTopic: string | null;
  onSelectTopic: (topic: string | null) => void;
}) {
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TopicDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSpeakers, setShowSpeakers] = useState(5);
  const [showArrangers, setShowArrangers] = useState(5);
  const abortRef = useRef<AbortController | null>(null);

  // Load topic list on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/dashboard?view=topics', { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        setTopics(d.topics || []);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Load detail when selectedTopic changes
  useEffect(() => {
    if (!selectedTopic) {
      setDetail(null);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setDetailLoading(true);
    setDetail(null);
    setShowSpeakers(5);
    setShowArrangers(5);
    fetch(`/api/dashboard?view=topic-detail&topic=${encodeURIComponent(selectedTopic)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!controller.signal.aborted) {
          setDetail(d);
          setDetailLoading(false);
        }
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selectedTopic]);

  if (selectedTopic) {
    // Detail view
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button
          onClick={() => onSelectTopic(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff6632',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: '0',
            marginBottom: '1.5rem',
          }}
        >
          ← Tillbaka till alla ämnen
        </button>

        {detailLoading || !detail ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Laddar ämnesdata...</div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '8px',
              border: '2px solid #000',
              boxShadow: '4px 4px 0 #000',
              marginBottom: '1.5rem',
            }}>
              <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', margin: '0 0 0.5rem' }}>
                {formatTopic(detail.topic)}
              </h2>
              <p style={{ color: '#666', margin: 0, fontSize: '1.05rem' }}>
                {detail.totalEvents} seminarier totalt (2022–2025)
              </p>

              {/* Per-year bars */}
              {detail.perYear.length > 0 && (() => {
                const maxCount = Math.max(...detail.perYear.map(p => p.count), 1);
                return (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Seminarier per år
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                      {[2022, 2023, 2024, 2025].map(year => {
                        const entry = detail.perYear.find(p => p.year === year);
                        const count = entry?.count || 0;
                        const height = count > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
                              {count > 0 ? count : ''}
                            </div>
                            <div style={{
                              width: '100%',
                              height: `${Math.max(height * 0.7, count > 0 ? 4 : 0)}px`,
                              backgroundColor: count > 0 ? '#ff6632' : '#e0dcc8',
                              borderRadius: '2px 2px 0 0',
                              minHeight: count > 0 ? '4px' : '2px',
                            }} />
                            <div style={{ fontSize: '0.65rem', color: '#999', marginTop: '3px' }}>{year}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Sector breakdown */}
            {detail.sectorBreakdown.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
                  SEKTORFÖRDELNING
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detail.sectorBreakdown.filter(s => s.sector !== 'unknown').map(s => {
                    const maxSector = detail.sectorBreakdown[0]?.count || 1;
                    const pct = (s.count / maxSector) * 100;
                    return (
                      <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '140px', fontSize: '0.8rem', color: '#444', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: SECTOR_COLORS[s.sector] || '#ccc',
                            display: 'inline-block', flexShrink: 0,
                          }} />
                          {SECTOR_LABELS[s.sector] || s.sector}
                        </div>
                        <div style={{ flex: 1, height: '16px', backgroundColor: '#f0ede0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: SECTOR_COLORS[s.sector] || '#ccc',
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#333', minWidth: '30px', textAlign: 'right' }}>
                          {s.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top speakers */}
            {detail.topSpeakers.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
                  TOPP-TALARE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detail.topSpeakers.slice(0, showSpeakers).map(sp => (
                    <div
                      key={sp.id}
                      onClick={() => onOpenProfile(sp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f7f5e4',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e0dcc8',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{sp.name}</span>
                        {sp.category && (
                          <span style={{
                            backgroundColor: CATEGORY_COLORS[sp.category] || '#ccc',
                            color: '#fff',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '8px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                          }}>
                            {CATEGORY_LABELS[sp.category] || sp.category}
                          </span>
                        )}
                        {(sp.title || sp.org) && (
                          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                            {[sp.title, sp.org].filter(Boolean).join(' — ')}
                          </div>
                        )}
                      </div>
                      <span style={{
                        backgroundColor: '#ff6632',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {sp.eventCount} seminarier
                      </span>
                    </div>
                  ))}
                </div>
                {showSpeakers < detail.topSpeakers.length && (
                  <button
                    onClick={() => setShowSpeakers(s => s + 10)}
                    style={{
                      display: 'block',
                      margin: '1rem auto 0',
                      padding: '0.5rem 1.5rem',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Visa fler talare ({detail.topSpeakers.length - showSpeakers} till)
                  </button>
                )}
              </div>
            )}

            {/* Top arrangers */}
            {detail.topArrangers.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
                  TOPP-ARRANGÖRER
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detail.topArrangers.slice(0, showArrangers).map(arr => (
                    <div
                      key={arr.id}
                      onClick={() => onOpenArrangerProfile(arr.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f7f5e4',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e0dcc8',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {arr.sector && (
                          <span style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: SECTOR_COLORS[arr.sector] || '#ccc',
                            display: 'inline-block', flexShrink: 0,
                          }} />
                        )}
                        <span style={{ fontWeight: 600 }}>{arr.name}</span>
                        {arr.sector && (
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>
                            {SECTOR_LABELS[arr.sector] || arr.sector}
                          </span>
                        )}
                      </div>
                      <span style={{
                        backgroundColor: '#ff6632',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {arr.eventCount} seminarier
                      </span>
                    </div>
                  ))}
                </div>
                {showArrangers < detail.topArrangers.length && (
                  <button
                    onClick={() => setShowArrangers(s => s + 10)}
                    style={{
                      display: 'block',
                      margin: '1rem auto 0',
                      padding: '0.5rem 1.5rem',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Visa fler arrangörer ({detail.topArrangers.length - showArrangers} till)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <p style={{
        fontSize: '1.05rem',
        lineHeight: 1.7,
        marginBottom: '2rem',
        color: '#333',
      }}>
        21 ämneskluster som täcker alla Almedalens seminarier. Klicka för att se vilka talare och aktörer som driver varje fråga.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Laddar ämnen...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
          gap: '1rem',
        }}>
          {topics.map(t => (
            <div
              key={t.topic}
              onClick={() => onSelectTopic(t.topic)}
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '3px 3px 0 #000',
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translate(-2px, -2px)';
                e.currentTarget.style.boxShadow = '5px 5px 0 #000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '3px 3px 0 #000';
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                {formatTopic(t.topic)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {t.totalEvents} seminarier
                </span>
                {t.latestYoY !== null && t.latestYoY !== 0 && (
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: t.latestYoY > 0 ? '#2a9d8f' : '#e63946',
                  }}>
                    {t.latestYoY > 0 ? '▲' : '▼'} {Math.abs(Math.round(t.latestYoY))}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- AktorerTab ---

type ArrangerListItem = {
  id: number;
  name: string;
  sector: string | null;
  totalEvents: number;
  yearsActive: number;
};

type ArrangerProfileData = {
  arranger: {
    id: number;
    name: string;
    sector: string | null;
    subSector: string | null;
    totalEvents: number;
    agendaPower: number;
  };
  perYear: { year: number; events: number; panelSlotsGiven: number }[];
  topTopics: { topic: string; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; sharedEvents: number }[];
};

function AktorerTab({
  onOpenProfile,
  onOpenTopic,
  selectedArrangerId,
  onSelectArrangerId,
}: {
  onOpenProfile: (id: number) => void;
  onOpenTopic: (topic: string) => void;
  selectedArrangerId: number | null;
  onSelectArrangerId: (id: number | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [arrangers, setArrangers] = useState<ArrangerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [arrangerProfile, setArrangerProfile] = useState<ArrangerProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const searchArrangers = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '30');
      const res = await fetch(`/api/arrangers?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setArrangers(data.arrangers || []);
        setLoading(false);
        setHasSearched(true);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setArrangers([]);
        setLoading(false);
        setHasSearched(true);
      }
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchArrangers(value);
    }, 300);
  };

  // Load initial list or profile
  useEffect(() => {
    if (selectedArrangerId) {
      loadArrangerProfile(selectedArrangerId);
    } else {
      searchArrangers('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load profile when selectedArrangerId changes externally
  useEffect(() => {
    if (selectedArrangerId) {
      loadArrangerProfile(selectedArrangerId);
    } else {
      setArrangerProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArrangerId]);

  const loadArrangerProfile = async (id: number) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProfileLoading(true);
    setArrangerProfile(null);
    try {
      const res = await fetch(`/api/arrangers?id=${id}`, { signal: controller.signal });
      const data = await res.json();
      if (!controller.signal.aborted) {
        setArrangerProfile(data);
        setProfileLoading(false);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setArrangerProfile(null);
        setProfileLoading(false);
      }
    }
  };

  if (selectedArrangerId) {
    // Profile view
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button
          onClick={() => onSelectArrangerId(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff6632',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            padding: '0',
            marginBottom: '1.5rem',
          }}
        >
          ← Tillbaka till sökning
        </button>

        {profileLoading || !arrangerProfile ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Laddar aktörsprofil...</div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '8px',
              border: '2px solid #000',
              boxShadow: '4px 4px 0 #000',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', margin: 0 }}>
                  {arrangerProfile.arranger.name}
                </h2>
                {arrangerProfile.arranger.sector && (
                  <span style={{
                    backgroundColor: SECTOR_COLORS[arrangerProfile.arranger.sector] || '#ccc',
                    color: '#fff',
                    padding: '0.2rem 0.7rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}>
                    {SECTOR_LABELS[arrangerProfile.arranger.sector] || arrangerProfile.arranger.sector}
                  </span>
                )}
              </div>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Seminarier totalt', value: arrangerProfile.arranger.totalEvents },
                  { label: 'År aktiv', value: arrangerProfile.perYear.length },
                  { label: 'Agendakraft', value: arrangerProfile.arranger.agendaPower.toFixed(1) },
                ].map(item => (
                  <div key={item.label} style={{
                    backgroundColor: '#f7f5e4',
                    padding: '1rem',
                    borderRadius: '6px',
                    textAlign: 'center',
                    border: '1px solid #e0dcc8',
                  }}>
                    <div style={{ fontFamily: 'var(--font-formula)', fontSize: '1.8rem', color: '#ff6632', fontWeight: 700 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sparkline */}
              {arrangerProfile.perYear.length > 0 && (() => {
                const maxEvents = Math.max(...arrangerProfile.perYear.map(p => p.events), 1);
                return (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Seminarier per år
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '60px' }}>
                      {[2022, 2023, 2024, 2025].map(year => {
                        const entry = arrangerProfile.perYear.find(p => p.year === year);
                        const count = entry?.events || 0;
                        const height = count > 0 ? (count / maxEvents) * 100 : 0;
                        return (
                          <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
                              {count > 0 ? count : ''}
                            </div>
                            <div style={{
                              width: '100%',
                              height: `${Math.max(height * 0.5, count > 0 ? 4 : 0)}px`,
                              backgroundColor: count > 0 ? '#ff6632' : '#e0dcc8',
                              borderRadius: '2px 2px 0 0',
                              minHeight: count > 0 ? '4px' : '2px',
                            }} />
                            <div style={{ fontSize: '0.65rem', color: '#999', marginTop: '3px' }}>{year}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Top topics */}
            {arrangerProfile.topTopics.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
                  VANLIGASTE ÄMNEN
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {arrangerProfile.topTopics.map(t => (
                    <div
                      key={t.topic}
                      onClick={() => onOpenTopic(t.topic)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f7f5e4',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e0dcc8',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
                    >
                      <span style={{ fontWeight: 600 }}>{formatTopic(t.topic)}</span>
                      <span style={{
                        backgroundColor: '#000',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {t.count} seminarier
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top speakers */}
            {arrangerProfile.topSpeakers.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ fontFamily: 'var(--font-formula)', fontSize: '1.3rem', margin: '0 0 1rem' }}>
                  VANLIGASTE TALARE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {arrangerProfile.topSpeakers.map(sp => (
                    <div
                      key={sp.id}
                      onClick={() => onOpenProfile(sp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#f7f5e4',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e0dcc8',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#edeadc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f7f5e4'; }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{sp.name}</span>
                        {sp.category && (
                          <span style={{
                            backgroundColor: CATEGORY_COLORS[sp.category] || '#ccc',
                            color: '#fff',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '8px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                          }}>
                            {CATEGORY_LABELS[sp.category] || sp.category}
                          </span>
                        )}
                        {(sp.title || sp.org) && (
                          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                            {[sp.title, sp.org].filter(Boolean).join(' — ')}
                          </div>
                        )}
                      </div>
                      <span style={{
                        backgroundColor: '#ff6632',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {sp.sharedEvents} seminarier
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Search view
  return (
    <div>
      <div style={{ marginBottom: '2rem', maxWidth: '700px', margin: '0 auto 2rem' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Sök bland arrangörer..."
          autoFocus
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            fontSize: '1.3rem',
            border: '3px solid #000',
            borderRadius: '8px',
            fontFamily: 'inherit',
            backgroundColor: '#fff',
            boxShadow: '4px 4px 0 #000',
            outline: 'none',
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Söker...</div>
      ) : (
        <>
          {!query.trim() && arrangers.length > 0 && (
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Mest aktiva organisationer i Almedalen
            </p>
          )}
          {query.trim() && arrangers.length === 0 && hasSearched && (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              Inga träffar för &quot;{query}&quot;
            </p>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
            gap: '1rem',
          }}>
            {arrangers.map(a => (
              <div
                key={a.id}
                onClick={() => onSelectArrangerId(a.id)}
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '8px',
                  border: '2px solid #000',
                  boxShadow: '3px 3px 0 #000',
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)';
                  e.currentTarget.style.boxShadow = '5px 5px 0 #000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '3px 3px 0 #000';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{a.name}</div>
                  <span style={{
                    backgroundColor: '#ff6632',
                    color: '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    marginLeft: '0.5rem',
                  }}>
                    {a.totalEvents} seminarier
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {a.sector && (
                    <span style={{
                      backgroundColor: SECTOR_COLORS[a.sector] || '#ccc',
                      color: '#fff',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}>
                      {SECTOR_LABELS[a.sector] || a.sector}
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>
                    {a.yearsActive} år aktiv
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
