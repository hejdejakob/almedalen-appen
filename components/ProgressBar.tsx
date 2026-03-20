interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({
  currentStep,
  totalSteps,
}: ProgressBarProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div>
      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: "0.75rem",
          textTransform: "uppercase",
          textAlign: "center",
          margin: "0 0 0.5rem 0",
        }}
      >
        FRÅGA {currentStep + 1} AV {totalSteps}
      </p>
      <div
        style={{
          width: "100%",
          height: 4,
          background: "#aaa9ab",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#ff6632",
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}
