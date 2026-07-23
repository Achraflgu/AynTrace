import { validatePassword } from '@/lib/password-validation';
import { Check } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const result = validatePassword(password);
  const { score, labelText, colorClass, criteria } = result;

  return (
    <div className="mt-2.5 space-y-3 p-3.5 rounded-xl border border-border/40 bg-secondary/20 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header with Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Force du mot de passe :</span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition-all duration-300 ${
          score === 4 ? 'bg-[#039C51]/10 text-[#039C51]' :
          score >= 2 ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
          'bg-red-500/10 text-red-500'
        }`}>
          {labelText}
        </span>
      </div>

      {/* 4-segment progress bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
        {[0, 1, 2, 3].map((index) => {
          const isActive = index < score;
          let segmentColor = 'bg-muted';
          if (isActive) {
            segmentColor = colorClass;
          }
          return (
            <div
              key={index}
              className={`h-full rounded-full transition-all duration-500 ease-out ${segmentColor}`}
            />
          );
        })}
      </div>

      {/* Criteria checklist */}
      <div className="space-y-1.5 pt-1">
        {criteria.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 text-[11px] transition-all duration-300"
          >
            <div className={`flex items-center justify-center w-4 h-4 rounded-full transition-all duration-300 ${
              c.met 
                ? 'bg-[#039C51]/15 text-[#039C51] scale-100' 
                : 'bg-muted text-muted-foreground scale-95'
            }`}>
              {c.met ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <div className="w-1 h-1 rounded-full bg-muted-foreground/60" />
              )}
            </div>
            <span className={`transition-colors duration-300 ${
              c.met ? 'text-[#039C51] font-medium' : 'text-muted-foreground'
            }`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
