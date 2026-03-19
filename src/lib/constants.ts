// Types d'annotations disponibles
export const ANNOTATION_TYPES = [
  { code: "M", label: "Mission", color: "#f5d764", description: "En mission" },
  {
    code: "J",
    label: "Justifié",
    color: "#a8d8a8",
    description: "Absence justifiée",
  },
  {
    code: "Md",
    label: "Maladie",
    color: "#f5a0c8",
    description: "Arrêt maladie",
  },
  {
    code: "Rc",
    label: "Récupération",
    color: "#a0c8f5",
    description: "Récupération",
  },
  { code: "C", label: "Congé", color: "#c8a0f5", description: "Congés payés" },
  {
    code: "Ce",
    label: "Congé exceptionnel",
    color: "#f5c8a0",
    description: "Congé exceptionnel",
  },
];

// Statuts de base
export const BASE_STATUS = [
  { code: "P", label: "Présent", color: "#c8f564" },
  { code: "A", label: "Absent", color: "#f56464" },
  { code: "R", label: "Repos", color: "#6488f5" },
];

// Jours de la semaine
export const DAYS = [
  { id: 0, label: "Dimanche", short: "Dim" },
  { id: 1, label: "Lundi", short: "Lun" },
  { id: 2, label: "Mardi", short: "Mar" },
  { id: 3, label: "Mercredi", short: "Mer" },
  { id: 4, label: "Jeudi", short: "Jeu" },
  { id: 5, label: "Vendredi", short: "Ven" },
  { id: 6, label: "Samedi", short: "Sam" },
];

// Mois
export const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Types de cycles
export const CYCLE_TYPES = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "rotation", label: "Rotation" },
  { value: "night", label: "Nuit" },
  { value: "unknown", label: "Inconnu" },
];
