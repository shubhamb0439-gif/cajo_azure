import { useMemo } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  requirements: PasswordRequirement[];
}

export default function PasswordStrengthIndicator({
  password,
  showRequirements = true
}: PasswordStrengthIndicatorProps) {

  const strength = useMemo((): PasswordStrength => {
    const requirements: PasswordRequirement[] = [
      {
        label: 'At least 8 characters',
        met: password.length >= 8,
      },
      {
        label: 'Contains uppercase letter',
        met: /[A-Z]/.test(password),
      },
      {
        label: 'Contains lowercase letter',
        met: /[a-z]/.test(password),
      },
      {
        label: 'Contains number',
        met: /\d/.test(password),
      },
      {
        label: 'Contains special character',
        met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      },
    ];

    const metCount = requirements.filter(r => r.met).length;

    let score = 0;
    let label = '';
    let color = '';

    if (password.length === 0) {
      score = 0;
      label = '';
      color = 'bg-slate-200 dark:bg-slate-700';
    } else if (metCount <= 2) {
      score = 1;
      label = 'Weak';
      color = 'bg-red-500';
    } else if (metCount === 3) {
      score = 2;
      label = 'Fair';
      color = 'bg-orange-500';
    } else if (metCount === 4) {
      score = 3;
      label = 'Good';
      color = 'bg-yellow-500';
    } else {
      score = 4;
      label = 'Strong';
      color = 'bg-green-500';
    }

    return { score, label, color, requirements };
  }, [password]);

  if (!password && !showRequirements) {
    return null;
  }

  return (
    <div className="space-y-3">
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Password Strength:</span>
            <span className={`font-medium ${
              strength.score === 1 ? 'text-red-600 dark:text-red-400' :
              strength.score === 2 ? 'text-orange-600 dark:text-orange-400' :
              strength.score === 3 ? 'text-yellow-600 dark:text-yellow-400' :
              strength.score === 4 ? 'text-green-600 dark:text-green-400' :
              'text-slate-500'
            }`}>
              {strength.label}
            </span>
          </div>

          <div className="flex gap-1">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  level <= strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {showRequirements && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>Password Requirements</span>
          </div>

          {strength.requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {req.met ? (
                <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-slate-400 dark:text-slate-600 flex-shrink-0" />
              )}
              <span className={req.met
                ? 'text-slate-700 dark:text-slate-300'
                : 'text-slate-500 dark:text-slate-500'
              }>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
