'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

type GroupTopic = { topic: string; orgs: number; events: number };
type TrendItem = { id: number; name: string; perYear: Record<string, number>; change: number; firstYear: number; lastYear: number };
type BridgePerson = { id: number; name: string; title: string | null; org: string | null; orgCount: number; orgs: string[] };
type SentimentItem = { id: number; name: string; avg: number; pos: number; neu: number; neg: number; total: number };
type VenueItem = { name: string; events: number; orgs: number };
type VenueCoord = { name: string; lat: number; lng: number; [key: string]: unknown };

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

const SECTOR_LABELS: Record<string, string> = {
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  arbetsgivar_branschorg: 'Arbetsgivar/bransch',
  fackförbund: 'Fackförbund',
  civilsamhälle: 'Civilsamhälle',
  tänketank_stiftelse: 'Tankesmedja',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

const TOPIC_LABELS: Record<string, string> = {
  arbetsmarknad_löner: 'Arbetsmarknad',
  välfärd_omsorg: 'Välfärd',
  hälsa_sjukvård: 'Hälsa & sjukvård',
  skola_utbildning_forskning: 'Utbildning',
  klimat_miljö_hållbarhet: 'Klimat & miljö',
  energi: 'Energi',
  bostäder_samhällsbyggnad: 'Bostäder',
  transport_infrastruktur: 'Transport',
  ekonomi_tillväxt: 'Ekonomi',
  skatter_offentliga_finanser: 'Skatter',
  näringsliv_innovation: 'Innovation',
  digitalisering_ai: 'AI & digitalisering',
  försvar_säkerhet: 'Försvar & säkerhet',
  demokrati_rättsstat: 'Demokrati',
  integration_migration: 'Integration',
  eu_utrikespolitik: 'EU & utrikes',
  jämställdhet_mångfald: 'Jämställdhet',
  media_kommunikation: 'Media',
  kultur_idrott: 'Kultur & idrott',
  barn_ungdom: 'Barn & ungdom',
  övrigt: 'Övrigt',
};

type Speaker = { id: number; name: string; title: string | null; org: string | null; events?: number };
type Node = {
  id: number;
  name: string;
  sector: string;
  events: number;
  topTopics: string[];
  topSpeakers: Speaker[];
  totalSpeakers: number;
};
type Edge = { source: number; target: number; weight: number; sharedSpeakers: Speaker[] };
type Stats = {
  totalOrgs: number;
  totalEvents: number;
  totalConnections: number;
  totalSharedSpeakers: number;
  sectors: Record<string, number>;
};

type SelectedEdge = {
  sourceName: string;
  targetName: string;
  sharedSpeakers: Speaker[];
};

export default function EventPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [groupTopics, setGroupTopics] = useState<GroupTopic[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [bridgePersons, setBridgePersons] = useState<BridgePerson[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentItem[]>([]);
  const [venueData, setVenueData] = useState<VenueItem[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/event-network')
      .then(r => r.json())
      .then(data => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setStats(data.stats || null);
        setGroupTopics(data.groupTopics || []);
        setTrends(data.trends || []);
        setBridgePersons(data.bridgePersons || []);
        setSentimentData(data.sentimentData || []);
        setVenueData(data.venueData || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    if (node && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, []);

  const handleEdgeSelect = useCallback((edge: SelectedEdge | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    if (edge && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, []);

  // Get connections for a node
  const getNodeConnections = (nodeId: number) => {
    return edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source;
        const otherNode = nodes.find(n => n.id === otherId);
        return { name: otherNode?.name || 'Okänd', weight: e.weight, id: otherId };
      })
      .sort((a, b) => b.weight - a.weight);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: 'clamp(2rem, 6vw, 4rem) clamp(1rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '0.75rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#ff6632',
          marginBottom: '0.75rem',
          fontWeight: 600,
        }}>
          Reform Society presenterar
        </p>
        <h1 style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(2.5rem, 8vw, 5rem)',
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, #999 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ERT ALMEDALSNÄTVERK
        </h1>
        <p style={{
          fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
          color: '#999',
          marginTop: '1rem',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.5,
        }}>
          {stats ? stats.totalOrgs : '...'} organisationer. 4 {'\u00e5'}r av data. {stats ? stats.totalConnections : '...'} kopplingar genom {stats ? stats.totalSharedSpeakers : '...'} gemensamma talare.
        </p>
      </header>

      {/* Network Graph */}
      <section style={{ padding: '0 clamp(0.5rem, 2vw, 2rem)' }}>
        <div style={{
          backgroundColor: '#111',
          borderRadius: '12px',
          border: '1px solid #222',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {loading ? (
            <div style={{
              height: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '0.9rem',
            }}>
              Laddar n{'\u00e4'}tverksdata...
            </div>
          ) : (
            <NetworkGraph
              nodes={nodes}
              edges={edges}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
            />
          )}
          {/* Legend */}
          {!loading && (
            <div style={{
              position: 'absolute',
              bottom: '0.75rem',
              left: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem 0.8rem',
              fontSize: '0.65rem',
              color: '#888',
            }}>
              {Object.entries(SECTOR_COLORS).map(([key, color]) => {
                const hasNodes = nodes.some(n => n.sector === key);
                if (!hasNodes) return null;
                return (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: color, display: 'inline-block',
                    }} />
                    {SECTOR_LABELS[key] || key}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panels (below graph) */}
        <div ref={detailRef}>
          {selectedEdge && (
            <EdgeDetailPanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
          )}
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              connections={getNodeConnections(selectedNode.id)}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      </section>

      {/* Stats Bar */}
      {stats && (
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1px',
          backgroundColor: '#222',
          margin: 'clamp(1rem, 3vw, 2rem) clamp(0.5rem, 2vw, 2rem)',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #222',
        }}>
          {[
            { label: 'Organisationer', value: stats.totalOrgs },
            { label: 'Seminarier totalt', value: stats.totalEvents },
            { label: 'Kopplingar', value: stats.totalConnections },
            { label: 'Gemensamma talare', value: stats.totalSharedSpeakers },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: '#111',
              padding: 'clamp(1rem, 2vw, 1.5rem)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-formula)',
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#ff6632',
                lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: '#888',
                marginTop: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Sector Bar */}
      {stats && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 4vw, 3rem)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            color: '#fff',
            marginBottom: '0.75rem',
          }}>
            Sektorbalans i rummet
          </h2>
          <div style={{
            display: 'flex',
            height: '32px',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #333',
          }}>
            {Object.entries(stats.sectors)
              .sort((a, b) => b[1] - a[1])
              .map(([sector, count]) => {
                const pct = (count / stats.totalOrgs) * 100;
                return (
                  <div
                    key={sector}
                    title={`${SECTOR_LABELS[sector] || sector}: ${count}`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: SECTOR_COLORS[sector] || '#555',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      color: '#000',
                      fontWeight: 700,
                      minWidth: pct > 8 ? 'auto' : '0',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pct > 10 ? `${SECTOR_LABELS[sector] || sector}` : ''}
                  </div>
                );
              })}
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}>
            {Object.entries(stats.sectors)
              .sort((a, b) => b[1] - a[1])
              .map(([sector, count]) => (
                <span key={sector} style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: SECTOR_COLORS[sector] || '#555',
                    display: 'inline-block',
                  }} />
                  {SECTOR_LABELS[sector] || sector} ({count})
                </span>
              ))}
          </div>
        </section>
      )}

      {/* Organization Cards */}
      {!loading && nodes.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginBottom: 'clamp(2rem, 5vw, 4rem)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            color: '#fff',
            marginBottom: '1rem',
          }}>
            Alla organisationer
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}>
            {[...nodes]
              .sort((a, b) => b.events - a.events)
              .map(node => {
                const connections = getNodeConnections(node.id);
                const isExpanded = expandedCardId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setExpandedCardId(isExpanded ? null : node.id)}
                    style={{
                      backgroundColor: isExpanded ? '#222' : '#1a1a1a',
                      border: `1px solid ${isExpanded ? '#ff6632' : '#333'}`,
                      borderRadius: '10px',
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      transition: 'border-color 0.2s, background-color 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        margin: 0,
                        lineHeight: 1.2,
                        flex: 1,
                      }}>
                        {node.name}
                      </h3>
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '99px',
                        backgroundColor: SECTOR_COLORS[node.sector] || '#555',
                        color: ['fackförbund', 'akademi'].includes(node.sector) ? '#000' : '#fff',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginLeft: '0.5rem',
                      }}>
                        {SECTOR_LABELS[node.sector] || node.sector}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      fontSize: '0.75rem',
                      color: '#999',
                      marginBottom: node.topTopics.length > 0 || isExpanded ? '0.5rem' : 0,
                    }}>
                      <span><strong style={{ color: '#fff' }}>{node.events}</strong> seminarier</span>
                      <span><strong style={{ color: '#fff' }}>{node.totalSpeakers}</strong> talare</span>
                      <span><strong style={{ color: '#fff' }}>{connections.length}</strong> kopplingar</span>
                    </div>
                    {node.topTopics.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {node.topTopics.map(topic => (
                          <span key={topic} style={{
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: '#2a2a2a',
                            color: '#bbb',
                            border: '1px solid #3a3a3a',
                          }}>
                            {TOPIC_LABELS[topic] || topic}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded card content */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #333',
                      }}>
                        {/* Top speakers */}
                        {node.topSpeakers && node.topSpeakers.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>
                              Topptalare
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              {node.topSpeakers.map(spk => (
                                <div key={spk.id} style={{
                                  backgroundColor: '#2a2a2a',
                                  borderRadius: '6px',
                                  padding: '0.4rem 0.6rem',
                                  fontSize: '0.75rem',
                                }}>
                                  <span style={{ fontWeight: 600, color: '#fff' }}>{spk.name}</span>
                                  {(spk.title || spk.org) && (
                                    <span style={{ color: '#999', marginLeft: '0.4rem' }}>
                                      {[spk.title, spk.org].filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                  <span style={{ color: '#ff6632', marginLeft: '0.4rem', fontSize: '0.65rem' }}>
                                    {spk.events} event
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Connections */}
                        {connections.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>
                              Kopplingar i nätverket
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {connections.slice(0, 8).map(conn => (
                                <span key={conn.id} style={{
                                  fontSize: '0.65rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#2a2a2a',
                                  color: '#ccc',
                                  border: '1px solid #3a3a3a',
                                }}>
                                  {conn.name} <span style={{ color: '#ff6632' }}>({conn.weight})</span>
                                </span>
                              ))}
                              {connections.length > 8 && (
                                <span style={{ fontSize: '0.65rem', color: '#666', padding: '0.2rem 0.3rem' }}>
                                  +{connections.length - 8} till
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Profile link */}
                        <a
                          href={`/speakers?tab=aktorer&id=${node.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-block',
                            marginTop: '0.3rem',
                            fontSize: '0.75rem',
                            color: '#ff6632',
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          Se fullständig profil →
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Section 1: ERA FRÅGOR */}
      {groupTopics.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginTop: '3rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            color: '#ff6632',
            marginBottom: '1.5rem',
          }}>
            ERA FRÅGOR
          </h2>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            padding: '1.25rem',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}>
            {(() => {
              const maxEvents = Math.max(...groupTopics.map(t => t.events));
              return groupTopics.map(t => {
                const label = TOPIC_LABELS[t.topic] || t.topic.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                return (
                  <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '120px', flexShrink: 0, fontSize: '0.8rem', color: '#fff', fontWeight: 600 }}>
                      {label}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '24px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(t.events / maxEvents) * 100}%`,
                        height: '100%',
                        backgroundColor: '#ff6632',
                        borderRadius: '4px',
                        minWidth: '4px',
                      }} />
                    </div>
                    <div style={{ flexShrink: 0, fontSize: '0.7rem', color: '#999', whiteSpace: 'nowrap' }}>
                      {t.orgs} org &middot; {t.events} seminarier
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>
      )}

      {/* Section 2: PERSONEN SOM BINDER ER SAMMAN */}
      {bridgePersons.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginTop: '3rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            color: '#ff6632',
            marginBottom: '1.5rem',
          }}>
            PERSONEN SOM BINDER ER SAMMAN
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bridgePersons.map((person, idx) => {
              const isHero = idx === 0;
              return (
                <a
                  key={person.id}
                  href={`/speakers?id=${person.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderLeft: isHero ? '4px solid #ff6632' : '1px solid #333',
                    padding: isHero ? '1.5rem' : '1.25rem',
                    borderRadius: '8px',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{
                    fontSize: isHero ? '1.2rem' : '0.95rem',
                    fontWeight: 700,
                    color: '#fff',
                    marginBottom: '0.3rem',
                  }}>
                    {person.name}
                  </div>
                  <div style={{
                    fontSize: isHero ? '0.85rem' : '0.75rem',
                    color: '#999',
                    marginBottom: '0.4rem',
                  }}>
                    {[person.title, person.org].filter(Boolean).join(' \u00b7 ')}
                  </div>
                  <div style={{
                    fontSize: isHero ? '0.85rem' : '0.75rem',
                    color: '#ff6632',
                    fontWeight: 600,
                    marginBottom: '0.4rem',
                  }}>
                    Medverkat hos {person.orgCount} organisationer
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#666',
                    lineHeight: 1.5,
                  }}>
                    {person.orgs.join(', ')}
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 3: TRENDER — VEM VÄXER? */}
      {trends.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginTop: '3rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            color: '#ff6632',
            marginBottom: '1.5rem',
          }}>
            TRENDER &mdash; VEM V&Auml;XER?
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '0.75rem',
          }}>
            {trends.map(t => {
              const years = ['2022', '2023', '2024', '2025'];
              const values = years.map(y => t.perYear[y] || 0);
              const maxVal = Math.max(...values, 1);
              const isPositive = t.change > 0;
              return (
                <div key={t.id} style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  padding: '1.25rem',
                  borderRadius: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                      {t.name}
                    </div>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: isPositive ? 'rgba(42, 157, 143, 0.2)' : 'rgba(230, 57, 70, 0.2)',
                      color: isPositive ? '#2a9d8f' : '#e63946',
                      whiteSpace: 'nowrap',
                    }}>
                      {isPositive ? '+' : '\u2212'}{Math.abs(t.change)} seminarier
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
                    {years.map((y, i) => (
                      <div key={y} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{
                          width: '100%',
                          height: `${(values[i] / maxVal) * 36}px`,
                          backgroundColor: '#ff6632',
                          borderRadius: '2px',
                          minHeight: values[i] > 0 ? '3px' : '0',
                        }} />
                        <span style={{ fontSize: '0.55rem', color: '#666' }}>{y.slice(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 4: TONLÄGE */}
      {sentimentData.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginTop: '3rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            color: '#ff6632',
            marginBottom: '1.5rem',
          }}>
            TONL&Auml;GE
          </h2>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            padding: '1.25rem',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.75rem' }}>
              <span style={{ color: '#2a9d8f', fontWeight: 600 }}>Mest optimistisk</span>
              <span style={{ color: '#e63946', fontWeight: 600 }}>Mest pessimistisk</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sentimentData.map(s => {
                // Interpolate color: positive → green, negative → red, zero → yellow
                const yellow = { r: 233, g: 196, b: 106 };
                const green = { r: 42, g: 157, b: 143 };
                const red = { r: 230, g: 57, b: 70 };
                let color: string;
                if (s.avg >= 0) {
                  const t = Math.min(s.avg * 5, 1);
                  color = `rgb(${Math.round(yellow.r + (green.r - yellow.r) * t)}, ${Math.round(yellow.g + (green.g - yellow.g) * t)}, ${Math.round(yellow.b + (green.b - yellow.b) * t)})`;
                } else {
                  const t = Math.min(-s.avg * 5, 1);
                  color = `rgb(${Math.round(yellow.r + (red.r - yellow.r) * t)}, ${Math.round(yellow.g + (red.g - yellow.g) * t)}, ${Math.round(yellow.b + (red.b - yellow.b) * t)})`;
                }
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '140px', flexShrink: 0, fontSize: '0.8rem', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </div>
                    <div style={{ flex: 1, height: '10px', backgroundColor: '#111', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${((s.avg + 1) / 2) * 100}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: '5px',
                        minWidth: '4px',
                      }} />
                    </div>
                    <div style={{ flexShrink: 0, fontSize: '0.7rem', color: '#999', width: '40px', textAlign: 'right' }}>
                      {s.avg > 0 ? '+' : ''}{s.avg.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Section 5: VAR I VISBY? */}
      {venueData.length > 0 && (
        <VenueMapSection venueData={venueData} />
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)',
        borderTop: '1px solid #222',
        color: '#666',
        fontSize: '0.75rem',
        lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          Data: <span style={{ color: '#ff6632' }}>Almedalsdata.se</span> — Reform Society, 2026
        </div>
        <div>
          Baserat p{'\u00e5'} 9 407 seminarier, 16 509 talare, 2022–2025.
        </div>
      </footer>
    </div>
  );
}

/* ─── Edge Detail Panel ─── */

function EdgeDetailPanel({ edge, onClose }: { edge: SelectedEdge; onClose: () => void }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderLeft: '3px solid #ff6632',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1rem',
      animation: 'fadeSlideIn 0.2s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            Gemensamma talare
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            {edge.sharedSpeakers.length} gemensamma talare mellan{' '}
            <span style={{ color: '#ff6632' }}>{edge.sourceName}</span> och{' '}
            <span style={{ color: '#ff6632' }}>{edge.targetName}</span>
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #444',
            color: '#999',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '4px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {edge.sharedSpeakers.map(spk => (
          <div key={spk.id} style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
          }}>
            <span style={{ fontWeight: 600, color: '#fff' }}>{spk.name}</span>
            {(spk.title || spk.org) && (
              <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                {[spk.title, spk.org].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Node Detail Panel ─── */

function NodeDetailPanel({
  node,
  connections,
  onClose,
}: {
  node: Node;
  connections: { name: string; weight: number; id: number }[];
  onClose: () => void;
}) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      borderLeft: '3px solid #ff6632',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1rem',
      animation: 'fadeSlideIn 0.2s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{node.name}</h3>
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: '99px',
            backgroundColor: SECTOR_COLORS[node.sector] || '#555',
            color: ['fackförbund', 'akademi'].includes(node.sector) ? '#000' : '#fff',
          }}>
            {SECTOR_LABELS[node.sector] || node.sector}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #444',
            color: '#999',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '4px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#999', marginBottom: '1rem' }}>
        <span><strong style={{ color: '#fff' }}>{node.events}</strong> seminarier</span>
        <span><strong style={{ color: '#fff' }}>{node.totalSpeakers}</strong> talare</span>
        <span><strong style={{ color: '#fff' }}>{connections.length}</strong> kopplingar</span>
      </div>

      {/* Topics */}
      {node.topTopics.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>
            Toppämnen
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {node.topTopics.map(topic => (
              <span key={topic} style={{
                fontSize: '0.7rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '99px',
                backgroundColor: '#2a2a2a',
                color: '#ccc',
                border: '1px solid #3a3a3a',
              }}>
                {TOPIC_LABELS[topic] || topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top speakers */}
      {node.topSpeakers && node.topSpeakers.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>
            Topptalare
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {node.topSpeakers.map(spk => (
              <div key={spk.id} style={{
                backgroundColor: '#2a2a2a',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
              }}>
                <span style={{ fontWeight: 600, color: '#fff' }}>{spk.name}</span>
                {(spk.title || spk.org) && (
                  <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                    {[spk.title, spk.org].filter(Boolean).join(', ')}
                  </span>
                )}
                {spk.events && (
                  <span style={{ color: '#ff6632', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                    {spk.events} event
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections */}
      {connections.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', fontWeight: 600 }}>
            Kopplingar i nätverket
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {connections.map(conn => (
              <span key={conn.id} style={{
                fontSize: '0.7rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                backgroundColor: '#2a2a2a',
                color: '#ccc',
                border: '1px solid #3a3a3a',
              }}>
                {conn.name} <span style={{ color: '#ff6632' }}>({conn.weight})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Link */}
      <a
        href={`/speakers?tab=aktorer&id=${node.id}`}
        style={{
          display: 'inline-block',
          fontSize: '0.85rem',
          color: '#ff6632',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Se fullständig profil →
      </a>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Network Graph sub-component ─── */

function NetworkGraph({
  nodes,
  edges,
  onNodeSelect,
  onEdgeSelect,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect: (node: Node | null) => void;
  onEdgeSelect: (edge: SelectedEdge | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: Node } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !nodes.length) return;

    let destroyed = false;

    import('d3').then(d3 => {
      if (destroyed) return;

      const container = containerRef.current!;
      const isMobile = container.clientWidth < 600;
      const actualWidth = container.clientWidth;
      const actualHeight = isMobile ? 500 : 700;

      const svg = d3.select(svgRef.current!);
      svg.selectAll('*').remove();

      svg
        .attr('width', actualWidth)
        .attr('height', actualHeight)
        .attr('viewBox', `0 0 ${actualWidth} ${actualHeight}`);

      // Defs for glow effect
      const defs = svg.append('defs');
      const filter = defs.append('filter').attr('id', 'glow');
      filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

      const g = svg.append('g');

      // Zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      // Scales
      const maxEvents = Math.max(...nodes.map(n => n.events), 1);
      const radiusScale = d3.scaleSqrt().domain([0, maxEvents]).range([6, isMobile ? 24 : 30]);
      const maxWeight = Math.max(...edges.map(e => e.weight), 1);
      const widthScale = d3.scaleLinear().domain([1, maxWeight]).range([2, 6]);

      const padding = 40;

      // Simulation
      const simNodes = nodes.map(n => ({ ...n })) as any[];
      const simEdges = edges.map(e => ({ ...e })) as any[];

      const simulation = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(isMobile ? 60 : 80).strength(0.4))
        .force('charge', d3.forceManyBody().strength(isMobile ? -120 : -200))
        .force('center', d3.forceCenter(actualWidth / 2, actualHeight / 2))
        .force('collision', d3.forceCollide().radius((d: any) => radiusScale(d.events) + 4))
        .force('x', d3.forceX(actualWidth / 2).strength(0.04))
        .force('y', d3.forceY(actualHeight / 2).strength(0.04));

      let pinnedId: number | null = null;

      function highlightNode(d: any) {
        node.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 1 : 0.12;
        });

        nodeGlow.attr('opacity', (n: any) => n.id === d.id ? 0.6 : 0);

        link
          .attr('stroke-opacity', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.03
          )
          .attr('stroke', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? '#ff6632' : '#555'
          );

        edgeLabel.attr('opacity', (l: any) =>
          (l.source.id === d.id || l.target.id === d.id) && l.weight >= 3 ? 0.9 : 0
        );

        label.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 0.9 : 0;
        });
      }

      function resetHighlight() {
        node.attr('opacity', 1);
        nodeGlow.attr('opacity', 0);
        link.attr('stroke-opacity', 0.25).attr('stroke', '#555');
        edgeLabel.attr('opacity', (d: any) => d.weight >= 3 ? 0.6 : 0);
        label.attr('opacity', (d: any) => d.events >= maxEvents * 0.2 ? 0.9 : 0);
      }

      // Draw edges (thicker hit area via transparent wider line)
      const linkHitArea = g.append('g')
        .selectAll('line')
        .data(simEdges)
        .join('line')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 12)
        .attr('cursor', 'pointer')
        .on('click', function (_event: any, d: any) {
          _event.stopPropagation();
          const edgeData = edges.find(e =>
            (e.source === d.source.id && e.target === d.target.id) ||
            (e.source === d.target.id && e.target === d.source.id)
          );
          if (edgeData) {
            const sourceNode = nodes.find(n => n.id === d.source.id);
            const targetNode = nodes.find(n => n.id === d.target.id);
            onEdgeSelect({
              sourceName: sourceNode?.name || 'Okänd',
              targetName: targetNode?.name || 'Okänd',
              sharedSpeakers: edgeData.sharedSpeakers || [],
            });
          }
        });

      const link = g.append('g')
        .selectAll('line')
        .data(simEdges)
        .join('line')
        .attr('stroke', '#555')
        .attr('stroke-opacity', 0.25)
        .attr('stroke-width', (d: any) => widthScale(d.weight))
        .attr('pointer-events', 'none');

      // Edge weight labels (for weight >= 3)
      const edgeLabel = g.append('g')
        .selectAll('text')
        .data(simEdges)
        .join('text')
        .attr('font-size', '8px')
        .attr('fill', '#888')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .attr('opacity', (d: any) => d.weight >= 3 ? 0.6 : 0)
        .text((d: any) => d.weight);

      // Glow layer (behind nodes)
      const nodeGlow = g.append('g')
        .selectAll('circle')
        .data(simNodes)
        .join('circle')
        .attr('r', (d: any) => radiusScale(d.events) + 6)
        .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#555')
        .attr('opacity', 0)
        .attr('filter', 'url(#glow)');

      // Draw nodes
      const node = g.append('g')
        .selectAll('circle')
        .data(simNodes)
        .join('circle')
        .attr('r', (d: any) => radiusScale(d.events))
        .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#555')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('mouseover', function (_event: any, d: any) {
          if (pinnedId !== null) return;
          highlightNode(d);
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip({
            x: _event.clientX - rect.left,
            y: _event.clientY - rect.top - 10,
            node: d,
          });
        })
        .on('mouseout', function () {
          if (pinnedId !== null) return;
          resetHighlight();
          setTooltip(null);
        })
        .on('click', function (_event: any, d: any) {
          _event.stopPropagation();
          if (pinnedId === d.id) {
            pinnedId = null;
            resetHighlight();
            setTooltip(null);
            onNodeSelect(null);
            return;
          }
          pinnedId = d.id;
          highlightNode(d);
          setTooltip(null);
          // Find the full node data (with topSpeakers etc.)
          const fullNode = nodes.find(n => n.id === d.id);
          onNodeSelect(fullNode || d);
        })
        .call(d3.drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
        );

      // Background click
      svg.on('click', () => {
        if (pinnedId !== null) {
          pinnedId = null;
          resetHighlight();
          setTooltip(null);
          onNodeSelect(null);
        }
      });

      // Labels
      const label = g.append('g')
        .selectAll('text')
        .data(simNodes)
        .join('text')
        .attr('font-size', isMobile ? '7px' : '9px')
        .attr('fill', '#ddd')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .attr('dy', (d: any) => -radiusScale(d.events) - 5)
        .attr('opacity', (d: any) => d.events >= maxEvents * 0.2 ? 0.9 : 0)
        .text((d: any) => d.name.length > 22 ? d.name.substring(0, 20) + '...' : d.name);

      simulation.on('tick', () => {
        for (const d of simNodes) {
          const r = radiusScale(d.events);
          d.x = Math.max(padding + r, Math.min(actualWidth - padding - r, d.x));
          d.y = Math.max(padding + r, Math.min(actualHeight - padding - r, d.y));
        }

        linkHitArea
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
        edgeLabel
          .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
          .attr('y', (d: any) => (d.source.y + d.target.y) / 2);
        node
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        nodeGlow
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        label
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      });

      // Cleanup
      return () => { simulation.stop(); };
    });

    return () => { destroyed = true; };
  }, [nodes, edges, onNodeSelect, onEdgeSelect]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: '500px',
        }}
      />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          padding: '0.4rem 0.7rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          border: '1px solid #333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div>{tooltip.node.name}</div>
          <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 400 }}>
            {tooltip.node.events} seminarier &middot; {SECTOR_LABELS[tooltip.node.sector] || tooltip.node.sector}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Venue Map Section ─── */

function VenueMapSection({ venueData }: { venueData: VenueItem[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !mapRef.current || mapInstanceRef.current) return;

    Promise.all([
      import('leaflet'),
      fetch('/venue-coordinates.json').then(r => r.json()),
    ]).then(([L, coordsObj]: [typeof import('leaflet'), Record<string, { lat: number; lng: number; locations?: string[] }>]) => {
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [57.638, 18.294],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Build coordinate lookup from object format: { "Venue Name": { lat, lng, locations } }
      const coordMap = new Map<string, { lat: number; lng: number }>();
      for (const [name, data] of Object.entries(coordsObj)) {
        coordMap.set(name.toLowerCase(), data);
        // Also index by each location variant
        if (data.locations) {
          for (const loc of data.locations) {
            coordMap.set(loc.toLowerCase(), data);
          }
        }
      }

      for (const v of venueData) {
        const vLower = v.name.toLowerCase();
        let matched: { lat: number; lng: number } | undefined;
        // Exact match first
        matched = coordMap.get(vLower);
        // Partial match
        if (!matched) {
          for (const [key, coord] of coordMap) {
            if (key.includes(vLower) || vLower.includes(key)) {
              matched = coord;
              break;
            }
          }
        }
        if (matched && matched.lat && matched.lng) {
          const radius = Math.sqrt(v.events) * 3;
          L.circleMarker([matched.lat, matched.lng], {
            radius: Math.max(radius, 4),
            fillColor: '#ff6632',
            color: '#ff6632',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          })
            .bindTooltip(`${v.name}<br/>${v.events} events, ${v.orgs} organisationer`, {
              className: 'venue-tooltip',
            })
            .addTo(map);
        }
      }

      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isMounted, venueData]);

  return (
    <section style={{
      padding: '0 clamp(0.5rem, 2vw, 2rem)',
      marginTop: '3rem',
    }}>
      <h2 style={{
        fontFamily: 'var(--font-formula)',
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        color: '#ff6632',
        marginBottom: '1.5rem',
      }}>
        VAR I VISBY?
      </h2>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {!isMounted ? (
          <div style={{ height: '400px', background: '#111' }} />
        ) : (
          <div
            ref={mapRef}
            style={{ height: 'clamp(400px, 50vw, 500px)', width: '100%' }}
          />
        )}
      </div>
      <style>{`
        .venue-tooltip {
          background-color: #1a1a1a !important;
          border: 1px solid #444 !important;
          color: #fff !important;
          font-size: 0.75rem !important;
          padding: 0.4rem 0.6rem !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
        }
        .venue-tooltip .leaflet-tooltip-tip {
          border-top-color: #1a1a1a !important;
        }
      `}</style>
    </section>
  );
}
