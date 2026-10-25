import React, { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, X, Clock } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionTitle?: string;
  actionDescription?: string;
  warningText?: string;
  expectedPin?: string;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds
const SESSION_LOCKOUT_KEY = 'orderflow_admin_pin_lockout_until';

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionTitle = 'Admin Authorization Required',
  actionDescription = 'This sensitive action requires Admin PIN verification.',
  warningText = 'Deleting or modifying financial records directly impacts accounting ledgers and customer balances.',
  expectedPin = '1977',
  onShowToast
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  // Check existing lockout on mount / open
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setErrorMsg('');
      return;
    }

    const storedLockout = sessionStorage.getItem(SESSION_LOCKOUT_KEY);
    if (storedLockout) {
      const remaining = Math.max(0, Math.ceil((parseInt(storedLockout, 10) - Date.now()) / 1000));
      if (remaining > 0) {
        setLockoutRemaining(remaining);
      } else {
        sessionStorage.removeItem(SESSION_LOCKOUT_KEY);
      }
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          sessionStorage.removeItem(SESSION_LOCKOUT_KEY);
          setFailedAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const isLocked = lockoutRemaining > 0;

  const handleDigitPress = (digit: string) => {
    if (isLocked || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setErrorMsg('');
    if (newPin.length === 4) {
      handleVerifyPin(newPin);
    }
  };

  const handleBackspace = () => {
    if (isLocked) return;
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    if (isLocked) return;
    setPin('');
    setErrorMsg('');
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleVerifyPin = (pinToTest: string) => {
    if (pinToTest === expectedPin) {
      setFailedAttempts(0);
      setPin('');
      setErrorMsg('');
      if (onShowToast) {
        onShowToast('success', 'Admin Authorized', 'PIN verified successfully.');
      }
      onSuccess();
      onClose();
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPin('');
      triggerShake();

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockoutEnd = Date.now() + LOCKOUT_DURATION_MS;
        sessionStorage.setItem(SESSION_LOCKOUT_KEY, String(lockoutEnd));
        setLockoutRemaining(30);
        setErrorMsg('Too many incorrect attempts. Verification locked for 30 seconds.');
        if (onShowToast) {
          onShowToast('error', 'Security Lockout', 'Admin verification temporarily suspended for 30s.');
        }
      } else {
        const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
        setErrorMsg(`Incorrect Admin PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }
    }
  };

  // Keyboard support for typing digits
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (/^[0-9]$/.test(e.key)) {
      handleDigitPress(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget && !isLocked) onClose();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden relative ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5">
                {actionTitle}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Security Passcode Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLocked}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Details & Warning */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900">
                <p className="font-bold">{actionDescription}</p>
                {warningText && <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">{warningText}</p>}
              </div>
            </div>
          </div>

          {/* Masked PIN Display */}
          <div className="space-y-2 text-center pt-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Enter 4-Digit Admin PIN
              </span>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors cursor-pointer"
                title={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* 4 Pin Slots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3].map(index => {
                const hasValue = pin.length > index;
                const char = pin[index];
                return (
                  <div
                    key={index}
                    className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-mono transition-all ${
                      hasValue
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-xs scale-105'
                        : isLocked
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-slate-50 text-slate-400'
                    }`}
                  >
                    {hasValue ? (showPin ? char : '●') : ''}
                  </div>
                );
              })}
            </div>

            {/* Lockout or Error Status */}
            {isLocked ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Verification locked. Try again in {lockoutRemaining}s</span>
              </div>
            ) : errorMsg ? (
              <p className="text-xs font-bold text-rose-600 animate-in fade-in">{errorMsg}</p>
            ) : (
              <p className="text-[11px] text-slate-400">Default security PIN: 1977</p>
            )}
          </div>

          {/* Numeric Touch Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigitPress(num)}
                disabled={isLocked}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-lg font-mono flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={isLocked || pin.length === 0}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 font-semibold text-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              disabled={isLocked}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-lg font-mono flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isLocked || pin.length === 0}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-semibold text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Backspace"
            >
              ⌫
            </button>
          </div>

          {/* Cancel button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLocked}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
