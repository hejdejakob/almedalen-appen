"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { marked } from "marked";
import ProgressBar from "@/components/ProgressBar";
import Footer from "@/components/Footer";
import {
  type QuizState,
  INITIAL_STATE,
  ROLE_OPTIONS,
  DAY_OPTIONS,
  isStepValid,
} from "@/lib/quiz-data";

const inputStyle: React.CSSProperties = {
  border: "2px solid #000",
  borderRadius: 0,
  padding: "0.75rem",
  fontFamily: '"Inter", sans-serif',
  fontSize: "1rem",
  width: "100%",
  background: "#fff",
  outline: "none",
};

export default function QuizPage() {
  const [state, setState] = useState<QuizState>(INITIAL_STATE);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"quiz" | "loading" | "result" | "error">(
    "quiz"
  );
  const [loadingText, setLoadingText] = useState(0);
  const [streamedContent, setStreamedContent] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const update = (partial: Partial<QuizState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  useEffect(() => {
    if (phase === "loading") {
      const timer = setTimeout(() => setLoadingText(1), 8000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Parse markdown to HTML whenever streamed content changes
  useEffect(() => {
    if (streamedContent) {
      setRenderedHtml(marked.parse(streamedContent, { async: false }) as string);
    }
  }, [streamedContent]);

  // Auto-scroll as content streams in
  useEffect(() => {
    if (phase === "result" && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [renderedHtml, phase]);

  const handleGenerate = async () => {
    setPhase("loading");
    setLoadingText(0);
    setStreamedContent("");

    try {
      const response = await fetch("/api/generate-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Något gick fel");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream available");

      const decoder = new TextDecoder();
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (firstChunk) {
          setPhase("result");
          firstChunk = false;
        }
        setStreamedContent((prev) => prev + text);
      }

      // Flush any remaining bytes in the decoder
      const remaining = decoder.decode();
      if (remaining) {
        setStreamedContent((prev) => prev + remaining);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Något gick fel"
      );
      setPhase("error");
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      handleGenerate();
    }
  };

  const toggleArray = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const valid = isStepValid(step, state);

  // ── Error screen ──
  if (phase === "error") {
    return (
      <div
        style={{
          background: "#ff6632",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: "2rem" }}>
          <Image
            src="/logo.svg"
            alt="Reform Society"
            width={120}
            height={17}
            style={{ filter: "brightness(0) invert(1)", maxWidth: 120 }}
          />
        </div>

        <h2
          style={{
            fontFamily: '"Formula Condensed", sans-serif',
            fontWeight: 700,
            fontSize: "3rem",
            color: "#fff",
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1,
            marginBottom: "1rem",
          }}
        >
          NÅGOT GICK FEL.
        </h2>
        <p
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: "0.9rem",
            color: "#fff",
            textAlign: "center",
            maxWidth: 500,
            marginBottom: "2rem",
          }}
        >
          {errorMessage}
        </p>
        <button
          onClick={() => {
            setPhase("quiz");
            setStep(5);
          }}
          style={{
            background: "#000",
            color: "#fff",
            border: "none",
            padding: "0.75rem 2rem",
            fontFamily: '"Formula Condensed", sans-serif',
            fontSize: "1.5rem",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          FÖRSÖK IGEN →
        </button>
      </div>
    );
  }

  // ── Result screen ──
  if (phase === "result") {
    return (
      <div
        style={{
          background: "#f7f5e4",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 64,
            padding: "0 5%",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <Image
            src="/logo.svg"
            alt="Reform Society"
            width={120}
            height={17}
            style={{ maxWidth: 120 }}
          />
        </header>

        {/* Title */}
        <div
          style={{
            padding: "1rem 5%",
            maxWidth: 800,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <h1
            style={{
              fontFamily: '"Formula Condensed", sans-serif',
              fontWeight: 700,
              fontSize: "2.5rem",
              textTransform: "uppercase",
              lineHeight: 1,
              marginBottom: "0.25rem",
            }}
          >
            {state.firstName}, DITT ALMEDALSPROGRAM
          </h1>
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: "0.85rem",
              color: "#666",
            }}
          >
            Genererat av Reform Society AI
          </p>
        </div>

        {/* Streamed content */}
        <main
          ref={resultRef}
          style={{
            flex: 1,
            maxWidth: 800,
            margin: "0 auto",
            padding: "0 5% 3rem",
            width: "100%",
          }}
        >
          <div
            className="program-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </main>

        <Footer />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              .program-content {
                font-family: "Inter", sans-serif;
                font-size: 1rem;
                line-height: 1.7;
              }
              .program-content h2 {
                font-family: "Formula Condensed", sans-serif;
                font-size: 2rem;
                margin-top: 2.5rem;
                margin-bottom: 0.5rem;
                padding-bottom: 0.5rem;
                border-bottom: 3px solid #000;
              }
              .program-content h3 {
                font-family: "Formula Condensed", sans-serif;
                font-size: 1.4rem;
                margin-top: 1.5rem;
                margin-bottom: 0.25rem;
              }
              .program-content p {
                margin: 0.5rem 0;
              }
              .program-content a {
                color: #ff6632;
                text-decoration: underline;
              }
              .program-content a:hover {
                color: #000;
              }
              .program-content strong {
                font-weight: 700;
              }
              .program-content ul, .program-content ol {
                padding-left: 1.5rem;
                margin: 0.5rem 0;
              }
              .program-content hr {
                border: none;
                border-top: 1px solid #ccc;
                margin: 2rem 0;
              }
            `,
          }}
        />
      </div>
    );
  }

  // ── Loading screen ──
  if (phase === "loading") {
    return (
      <div
        style={{
          background: "#ff6632",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: "2rem" }}>
          <Image
            src="/logo.svg"
            alt="Reform Society"
            width={120}
            height={17}
            style={{ filter: "brightness(0) invert(1)", maxWidth: 120 }}
          />
        </div>

        {/* Pulsing circle */}
        <div
          className="animate-pulse-circle circle"
          style={{
            width: 60,
            height: 60,
            background: "#000",
            marginBottom: "2rem",
          }}
        />

        {loadingText === 0 ? (
          <>
            <h2
              style={{
                fontFamily: '"Formula Condensed", sans-serif',
                fontWeight: 700,
                fontSize: "3rem",
                color: "#fff",
                textTransform: "uppercase",
                textAlign: "center",
                lineHeight: 1,
                marginBottom: "1rem",
              }}
            >
              VI LÄSER IGENOM 1 296 EVENTS.
            </h2>
            <p
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "0.9rem",
                color: "#fff",
                textAlign: "center",
                maxWidth: 500,
              }}
            >
              Du skulle aldrig göra det själv.
              <br />
              Det vet vi båda.
            </p>
          </>
        ) : (
          <>
            <h2
              style={{
                fontFamily: '"Formula Condensed", sans-serif',
                fontWeight: 700,
                fontSize: "3rem",
                color: "#fff",
                textTransform: "uppercase",
                textAlign: "center",
                lineHeight: 1,
                marginBottom: "1rem",
              }}
            >
              NÄSTAN KLART. VI SKRIVER DITT PROGRAM.
            </h2>
            <p
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "0.9rem",
                color: "#fff",
                textAlign: "center",
                maxWidth: 500,
              }}
            >
              Bara lite till.
            </p>
          </>
        )}

        {/* Decorative tilde */}
        <p
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: "3rem",
            color: "#fff",
            marginTop: "2rem",
          }}
        >
          ~
        </p>
      </div>
    );
  }

  // ── Quiz ──
  return (
    <div
      style={{
        background: "#f7f5e4",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 64,
          padding: "0 5%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Image
          src="/logo.svg"
          alt="Reform Society"
          width={120}
          height={17}
          style={{ maxWidth: 120 }}
        />
      </header>

      {/* Progress */}
      <div style={{ padding: "0 5%" }}>
        <ProgressBar currentStep={step} totalSteps={6} />
      </div>

      {/* Question content */}
      <main
        style={{
          flex: 1,
          maxWidth: 640,
          margin: "0 auto",
          padding: "2rem 1.5rem",
          width: "100%",
        }}
      >
        {/* FRÅGA 1 — VEM ÄR DU? */}
        {step === 0 && (
          <div
            style={{
              background: "#fff",
              boxShadow: "5px 5px 0px 0px #000",
              border: "1px solid #000",
              padding: "2.5rem",
            }}
          >
              <h2
                style={{
                  fontSize: "2.5rem",
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                }}
              >
                VEM ÄR DU?
              </h2>
              <p
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                Vi skickar ditt personliga program hit.
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                <input
                  type="text"
                  placeholder="Förnamn"
                  value={state.firstName}
                  onChange={(e) => update({ firstName: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#ff6632")
                  }
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
                />
                <input
                  type="text"
                  placeholder="Efternamn"
                  value={state.lastName}
                  onChange={(e) => update({ lastName: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#ff6632")
                  }
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
                />
                <input
                  type="email"
                  placeholder="E-postadress"
                  value={state.email}
                  onChange={(e) => update({ email: e.target.value })}
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#ff6632")
                  }
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
                />
              </div>
          </div>
        )}

        {/* FRÅGA 2 — VAD GÖR DU EGENTLIGEN DÄR? */}
        {step === 1 && (
          <div>
            <h2
              style={{
                fontSize: "2.5rem",
                lineHeight: 1,
                marginBottom: "1.5rem",
              }}
            >
              VAD GÖR DU EGENTLIGEN DÄR?
            </h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            >
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  onClick={() =>
                    update({ role: state.role === role ? null : role })
                  }
                  style={{
                    border: "2px solid #000",
                    borderRadius: 0,
                    background: state.role === role ? "#ff6632" : "#fff",
                    color: "#000",
                    padding: "1rem 1.5rem",
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "1rem",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    boxShadow: "3px 3px 0px 0px #000",
                    transition: "background 0.15s",
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FRÅGA 3 — VAD ÄR DIN OFFICIELLA ANLEDNING? */}
        {step === 2 && (
          <div
            style={{
              background: "#fff",
              boxShadow: "5px 5px 0px 0px #000",
              border: "1px solid #000",
              padding: "2.5rem",
            }}
          >
              <h2
                style={{
                  fontSize: "2.5rem",
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                }}
              >
                VAD ÄR DIN OFFICIELLA ANLEDNING?
              </h2>
              <p
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                Den verkliga är också okej.
              </p>
              <textarea
                value={state.focusArea}
                onChange={(e) => update({ focusArea: e.target.value })}
                placeholder={`"Nätverka" räknas.\n"Min chef bestämde" räknas också.`}
                style={{
                  ...inputStyle,
                  minHeight: 180,
                  resize: "vertical" as const,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "#ff6632")
                }
                onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
              />
          </div>
        )}

        {/* FRÅGA 4 — VAD BRINNER DU FÖR DÅ? */}
        {step === 3 && (
          <div
            style={{
              background: "#fff",
              boxShadow: "5px 5px 0px 0px #000",
              border: "1px solid #000",
              padding: "2.5rem",
            }}
          >
              <h2
                style={{
                  fontSize: "2.5rem",
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                }}
              >
                VAD BRINNER DU FÖR DÅ?
              </h2>
              <p
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                Det är valår. Alla har en hjärtefråga.
              </p>
              <textarea
                value={state.passion}
                onChange={(e) => update({ passion: e.target.value })}
                placeholder={`Inte "demokratin i stort".\nMer specifikt än så.`}
                style={{
                  ...inputStyle,
                  minHeight: 180,
                  resize: "vertical" as const,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "#ff6632")
                }
                onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
              />
          </div>
        )}

        {/* FRÅGA 5 — VILKA DAGAR ÄR DU PÅ PLATS? */}
        {step === 4 && (
          <div>
            <h2
              style={{
                fontSize: "2.5rem",
                lineHeight: 1,
                marginBottom: "0.5rem",
              }}
            >
              VILKA DAGAR ÄR DU PÅ PLATS?
            </h2>
            <p
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              Onsdag är kaos. Det är därför alla väljer onsdag.
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            >
              {DAY_OPTIONS.map((day) => {
                const selected = state.days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() =>
                      update({ days: toggleArray(state.days, day.value) })
                    }
                    style={{
                      border: "2px solid #000",
                      borderRadius: 0,
                      background: selected ? "#ff6632" : "#fff",
                      color: "#000",
                      padding: "1rem 1.5rem",
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "1rem",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                      boxShadow: "3px 3px 0px 0px #000",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      transition: "background 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        border: "2px solid #000",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FRÅGA 6 — NÅGOT DU INTE VILL MISSA — ELLER HELST SLIPPA? */}
        {step === 5 && (
          <div
            style={{
              background: "#fff",
              boxShadow: "5px 5px 0px 0px #000",
              border: "1px solid #000",
              padding: "2.5rem",
            }}
          >
              <h2
                style={{
                  fontSize: "2.5rem",
                  lineHeight: 1,
                  marginBottom: "0.5rem",
                }}
              >
                NÅGOT DU INTE VILL MISSA — ELLER HELST SLIPPA?
              </h2>
              <p
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                Valfritt men uppskattat.
              </p>
              <textarea
                value={state.preferences}
                onChange={(e) => update({ preferences: e.target.value })}
                placeholder={`En organisation, ett ämne, ett namn.\nEller bara "ingenting kl 08.00".`}
                style={{
                  ...inputStyle,
                  minHeight: 180,
                  resize: "vertical" as const,
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "#ff6632")
                }
                onBlur={(e) => (e.currentTarget.style.borderColor = "#000")}
              />
          </div>
        )}

        {/* Navigation */}
        <div style={{ marginTop: "2.5rem" }}>
          <button
            onClick={handleNext}
            disabled={!valid}
            className={valid ? "next-btn" : "next-btn-disabled"}
          >
            {step < 5 ? "NÄSTA →" : "SKAPA MITT PROGRAM →"}
          </button>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              .next-btn, .next-btn-disabled {
                width: 100%;
                padding: 0.75rem 2rem;
                font-family: "Formula Condensed", sans-serif;
                font-size: 1.5rem;
                text-transform: uppercase;
                border: none;
                border-radius: 0;
                transition: background 0.2s, color 0.2s;
              }
              .next-btn {
                background: #000;
                color: #fff;
                box-shadow: 5px 5px 0px 0px #000;
                cursor: pointer;
              }
              .next-btn:hover {
                background: #ff6632;
                color: #000;
              }
              .next-btn-disabled {
                background: #aaa9ab;
                color: #fff;
                box-shadow: none;
                cursor: not-allowed;
              }
            `,
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
