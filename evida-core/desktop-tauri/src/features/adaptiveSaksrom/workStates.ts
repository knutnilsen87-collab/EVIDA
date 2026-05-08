export const SAKSROM_WORK_STATES = [
  "Forstår spørsmålet",
  "Henter relevante kilder",
  "Ser etter mønstre og koblinger",
  "Sammenligner datoer og aktører",
  "Kontrollerer usikkerhet",
  "Skriver svar"
] as const;

export type SaksromWorkState = (typeof SAKSROM_WORK_STATES)[number];
