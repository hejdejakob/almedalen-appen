'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get('id');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SpeakerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
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
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '30');
      const res = await fetch(`/api/speakers?${params}`);
      const data = await res.json();
      setResults(data.speakers || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
    setHasSearched(true);
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
    router.replace('/speakers', { scroll: false });
    if (!hasSearched) searchSpeakers('');
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
        padding: '2rem 0',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>
              TALARSÖK
            </h1>
            <p style={{ fontSize: '1rem', opacity: 0.7, marginTop: '0.5rem' }}>
              Sök bland 16 509 paneldeltagare från Almedalsveckan 2022–2025
            </p>
          </div>
          <a href="/" style={{
            color: '#ff6632',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            ← Dashboard
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
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
