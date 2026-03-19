export function validateMatricule(matricule: string): boolean {
  return matricule.length > 0 && matricule.length <= 50;
}

export function validateDate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(date);
}
