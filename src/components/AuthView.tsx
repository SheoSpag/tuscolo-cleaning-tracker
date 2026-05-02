import { CheckCircle2, Eye, EyeOff, LogIn, RotateCw, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppUser, Language } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { languageLabels } from "../i18n/translations";

type AuthViewProps = {
  users: AppUser[];
  onLogin: (email: string, password: string) => Promise<boolean>;
  onStartRegister: (input: { name: string; email: string; password: string; language: Language }) => Promise<{ ok: boolean; devCode?: string; message?: string }>;
  onVerifyRegister: (email: string, code: string) => Promise<boolean>;
  error?: string;
};

const languages: Language[] = ["es", "de", "en", "it"];
const resendDelaySeconds = 30;

export function AuthView({ users, onLogin, onStartRegister, onVerifyRegister, error }: AuthViewProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerStep, setRegisterStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@tuscolo.de");
  const [password, setPassword] = useState("admin123");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<Language>("es");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const resetRegisterState = () => {
    setRegisterStep("form");
    setName("");
    setConfirmPassword("");
    setSentCode("");
    setConfirmationCode("");
    setPendingUser(null);
    setResendSeconds(0);
  };

  const switchMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setLocalError("");
    setNotice("");
    resetRegisterState();
    if (nextMode === "login") {
      setEmail("admin@tuscolo.de");
      setPassword("admin123");
    } else {
      setEmail("");
      setPassword("");
    }
  };

  const validateRegisterForm = () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setLocalError(t("errors.requiredFields"));
      return false;
    }

    if (password.length <= 6) {
      setLocalError(t("errors.weakPassword"));
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError(t("errors.passwordMismatch"));
      return false;
    }

    if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) {
      setLocalError(t("errors.emailExists"));
      return false;
    }

    return true;
  };

  const startEmailVerification = async () => {
    setLocalError("");
    if (!validateRegisterForm()) {
      return;
    }

    const nextUser: AppUser = {
      id: `pending-${crypto.randomUUID()}`,
      name: name.trim(),
      email: email.trim(),
      password,
      language,
      role: "employee",
    };

    const result = await onStartRegister({
      name: nextUser.name,
      email: nextUser.email,
      password,
      language,
    });

    if (!result.ok) {
      setLocalError(result.message ?? t("errors.requiredFields"));
      return;
    }

    setPendingUser(nextUser);
    setSentCode(result.devCode ?? "");
    setConfirmationCode("");
    setResendSeconds(resendDelaySeconds);
    setNotice(result.devCode ? `${t("auth.codeSent")} ${nextUser.email}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.codeSent")} ${nextUser.email}.`);
    setRegisterStep("verify");
  };

  const verifyAndRegister = async () => {
    setLocalError("");
    if (!pendingUser) {
      setRegisterStep("form");
      return;
    }

    if (sentCode && confirmationCode.trim() !== sentCode) {
      setLocalError(t("errors.invalidCode"));
      return;
    }

    const ok = await onVerifyRegister(pendingUser.email, confirmationCode.trim());
    if (!ok) {
      setLocalError(t("errors.invalidCode"));
    }
  };

  const resendCode = () => {
    if (!pendingUser || resendSeconds > 0) {
      return;
    }

    void onStartRegister({
      name: pendingUser.name,
      email: pendingUser.email,
      password,
      language,
    }).then((result) => {
      if (!result.ok) return;
      setSentCode(result.devCode ?? "");
      setConfirmationCode("");
      setResendSeconds(resendDelaySeconds);
      setNotice(result.devCode ? `${t("auth.codeSent")} ${pendingUser.email}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.codeSent")} ${pendingUser.email}.`);
    });
  };

  const submit = () => {
    setLocalError("");

    if (mode === "login") {
      onLogin(email.trim(), password);
      return;
    }

    if (registerStep === "form") {
      startEmailVerification();
      return;
    }

    verifyAndRegister();
  };

  const loadDemo = (user: AppUser) => {
    setEmail(user.email);
    setPassword(user.password ?? "");
  };

  const visibleError = localError || (mode === "login" ? error : "");

  return (
    <section className="auth-layout">
      <div className="intro-panel auth-hero">
        <LogIn size={34} />
        <p>{t("auth.kicker")}</p>
        <h2>Tuscolo</h2>
        <span>{t("app.slogan")}</span>
      </div>

      <div className="auth-panel">
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => switchMode("login")}>
            <LogIn size={17} />
            {t("auth.login")}
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => switchMode("register")}>
            <UserPlus size={17} />
            {t("auth.register")}
          </button>
        </div>

        {mode === "register" && registerStep === "verify" ? (
          <div className="verification-card">
            <CheckCircle2 size={36} />
            <h2>{t("auth.verifyTitle")}</h2>
            <p>{t("auth.verifyCopy")} <strong>{pendingUser?.email}</strong></p>

            <label className="field">
              <span>{t("fields.confirmationCode")}</span>
              <input value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value)} inputMode="numeric" />
            </label>

            {notice ? <p className="notice-text">{notice}</p> : null}
            {visibleError ? <p className="error-text">{visibleError}</p> : null}

            <button className="primary-action" type="button" onClick={submit}>
              <CheckCircle2 size={18} />
              {t("auth.verifyAndLogin")}
            </button>

            <div className="resend-code-row">
              <span>{t("auth.resendPrompt")}</span>
              <button className={resendSeconds > 0 ? "disabled" : ""} type="button" onClick={resendCode} disabled={resendSeconds > 0}>
                <RotateCw size={16} />
                {t("auth.resendCode")}
                {resendSeconds > 0 ? ` ${t("auth.inSeconds")} ${resendSeconds}s` : ""}
              </button>
            </div>
          </div>
        ) : (
          <>
            {mode === "register" ? (
              <label className="field">
                <span>{t("fields.name")}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
            ) : null}

            <label className="field">
              <span>{t("fields.email")}</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>

            <label className="field">
              <span>{t("fields.password")}</span>
              <div className="password-field">
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {mode === "register" ? (
              <>
                <label className="field">
                  <span>{t("fields.confirmPassword")}</span>
                  <div className="password-field">
                    <input
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type={showConfirmPassword ? "text" : "password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>{t("fields.language")}</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                    {languages.map((item) => (
                      <option key={item} value={item}>
                        {languageLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {visibleError ? <p className="error-text">{visibleError}</p> : null}

            <button className="primary-action" type="button" onClick={submit}>
              {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
              {mode === "login" ? t("auth.login") : t("auth.register")}
            </button>

            {mode === "login" ? (
              <div className="demo-users">
                <p>{t("auth.demoUsers")}</p>
                {users.filter((user) => user.password).slice(0, 3).map((user) => (
                  <button type="button" key={user.id} onClick={() => loadDemo(user)}>
                    {user.name} · {t(`roles.${user.role}`)}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
