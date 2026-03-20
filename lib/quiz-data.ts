export interface QuizState {
  firstName: string;
  lastName: string;
  email: string;
  role: string | null;
  focusArea: string;
  passion: string;
  days: string[];
  preferences: string;
}

export const INITIAL_STATE: QuizState = {
  firstName: "",
  lastName: "",
  email: "",
  role: null,
  focusArea: "",
  passion: "",
  days: [],
  preferences: "",
};

export const ROLE_OPTIONS = [
  "Politiker eller politisk tjänsteperson",
  "Statlig eller kommunal tjänsteperson",
  "Journalist eller kommunikatör",
  "Konsult eller PR-person",
  "Facklig förtroendevald",
  "Intresseorganisation eller civilsamhälle",
  "Annat",
];

export const DAY_OPTIONS = [
  { label: "Måndag 29 juni", value: "mon-29" },
  { label: "Tisdag 30 juni", value: "tue-30" },
  { label: "Onsdag 1 juli", value: "wed-01" },
  { label: "Torsdag 2 juli", value: "thu-02" },
  { label: "Fredag 3 juli", value: "fri-03" },
];

export function isStepValid(step: number, state: QuizState): boolean {
  switch (step) {
    case 0:
      return (
        state.firstName.trim() !== "" &&
        state.lastName.trim() !== "" &&
        state.email.trim() !== "" &&
        state.email.includes("@")
      );
    case 1:
      return state.role !== null;
    case 2:
      return state.focusArea.trim() !== "";
    case 3:
      return state.passion.trim() !== "";
    case 4:
      return state.days.length > 0;
    case 5:
      return true;
    default:
      return false;
  }
}
