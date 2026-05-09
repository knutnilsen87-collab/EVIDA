type Props = {
  active: boolean;
  currentStep: number;
};

const steps = [
  "Forstår spørsmålet",
  "Henter relevante kilder",
  "Ser etter mønstre og koblinger",
  "Sammenligner datoer og aktører",
  "Kontrollerer usikkerhet",
  "Skriver svar"
];

export function AssistantWorkState({ active, currentStep }: Props) {
  if (!active) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="assistant-work-card">
      <p>Evida arbeider med saken</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step} aria-current={index === currentStep ? "step" : undefined}>
            {index < currentStep ? "✓ " : index === currentStep ? "→ " : "• "}
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

