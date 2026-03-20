import Image from "next/image";
import Link from "next/link";

export default function Home() {
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
      {/* Logo */}
      <div style={{ position: "absolute", top: "2rem" }}>
        <Image
          src="/logo.svg"
          alt="Reform Society"
          width={120}
          height={17}
          style={{ filter: "brightness(0) invert(1)", maxWidth: 120 }}
          priority
        />
      </div>

      {/* Main content */}
      <h1
        style={{
          fontFamily: '"Formula Condensed", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(2.5rem, 10vw, 9rem)",
          lineHeight: 1,
          color: "#fff",
          textAlign: "center",
          textTransform: "uppercase",
          maxWidth: 900,
          margin: 0,
        }}
      >
        DITT PERSONLIGA ALMEDALSPROGRAM
      </h1>

      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: "1rem",
          color: "#fff",
          textAlign: "center",
          marginTop: "1.5rem",
          textTransform: "uppercase",
        }}
      >
        SVARA PÅ FEM FRÅGOR. FÅ ETT PROGRAM SKRÄDDARSYTT FÖR JUST DIG.
      </p>

      <Link href="/quiz" className="cta-btn">
        SKAPA MITT PROGRAM →
      </Link>


      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          fontFamily: '"Space Mono", monospace',
          fontSize: "0.75rem",
          color: "#fff",
          textAlign: "center",
        }}
      >
        REFORM ~ SOCIETY
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .cta-btn {
              display: inline-block;
              background: #000;
              color: #fff;
              padding: 1rem 3rem;
              font-family: "Formula Condensed", sans-serif;
              font-size: 2rem;
              text-transform: uppercase;
              text-decoration: none;
              border: none;
              border-radius: 0;
              box-shadow: 5px 5px 0px 0px #fff;
              margin-top: 2.5rem;
              transition: background 0.2s, color 0.2s;
            }
            .cta-btn:hover {
              background: #fff !important;
              color: #000 !important;
            }
          `,
        }}
      />
    </div>
  );
}
