export interface PasswordCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number;
  label: 'very-weak' | 'weak' | 'medium' | 'strong';
  labelText: string;
  colorClass: string;
  criteria: PasswordCriterion[];
  isValid: boolean;
}

export function validatePassword(password: string): PasswordStrengthResult {
  const criteria: PasswordCriterion[] = [
    { id: 'length', label: 'Au moins 8 caractères', met: password.length >= 8 },
    { id: 'uppercase', label: 'Au moins une lettre majuscule', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'Au moins un chiffre', met: /[0-9]/.test(password) },
    { id: 'special', label: 'Au moins un caractère spécial (ex: @$!%*?&)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = criteria.filter(c => c.met).length;

  let label: PasswordStrengthResult['label'] = 'very-weak';
  let labelText = 'Très faible';
  let colorClass = 'bg-red-500';

  if (score === 1) {
    label = 'weak';
    labelText = 'Faible';
    colorClass = 'bg-orange-500';
  } else if (score === 2 || score === 3) {
    label = 'medium';
    labelText = 'Moyen';
    colorClass = 'bg-yellow-500';
  } else if (score === 4) {
    label = 'strong';
    labelText = 'Sécurisé';
    colorClass = 'bg-[#039C51]'; // Matches AynTrace premium green
  }

  const isValid = criteria.every(c => c.met);

  return {
    score,
    label,
    labelText,
    colorClass,
    criteria,
    isValid,
  };
}
