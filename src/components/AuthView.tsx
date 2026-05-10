import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LogIn, Mail, RotateCw, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppUser, Language } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { languageLabels } from "../i18n/translations";

type AuthViewProps = {
  users: AppUser[];
  onLogin: (email: string, password: string) => Promise<boolean>;
  onStartRegister: (input: { name: string; email: string; password: string; language: Language }) => Promise<{ ok: boolean; emailSent?: boolean; devCode?: string; message?: string }>;
  onVerifyRegister: (email: string, code: string) => Promise<boolean>;
  onStartPasswordReset: (email: string) => Promise<{ ok: boolean; emailSent?: boolean; devCode?: string; message?: string }>;
  onVerifyPasswordReset: (email: string, code: string) => Promise<boolean>;
  onFinishPasswordReset: (email: string, code: string, password: string) => Promise<boolean>;
  error?: string;
};

const languages: Language[] = ["es", "de", "en", "it"];
const resendDelaySeconds = 30;
type AuthMode = "login" | "register" | "forgot";
type ForgotStep = "request" | "code" | "password";

export function AuthView({ users, onLogin, onStartRegister, onVerifyRegister, onStartPasswordReset, onVerifyPasswordReset, onFinishPasswordReset, error }: AuthViewProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AuthMode>("login");
  const [registerStep, setRegisterStep] = useState<"form" | "verify">("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [language, setLanguage] = useState<Language>("es");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [sentResetCode, setSentResetCode] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
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

  const resetForgotState = () => {
    setForgotStep("request");
    setSentResetCode("");
    setResetCode("");
    setResetPassword("");
    setConfirmResetPassword("");
    setResendSeconds(0);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError("");
    setNotice("");
    resetRegisterState();
    resetForgotState();
    if (nextMode !== "forgot") setEmail("");
    setPassword("");
    setConfirmPassword("");
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
    setNotice(result.devCode && !result.emailSent ? `${t("auth.codeSent")} ${nextUser.email}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.codeSent")} ${nextUser.email}.`);
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
      setNotice(result.devCode && !result.emailSent ? `${t("auth.codeSent")} ${pendingUser.email}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.codeSent")} ${pendingUser.email}.`);
    });
  };

  const startResetRequest = async () => {
    setLocalError("");
    if (!email.trim()) {
      setLocalError(t("errors.requiredFields"));
      return;
    }

    const result = await onStartPasswordReset(email.trim());
    if (!result.ok) {
      setLocalError(result.message ?? t("errors.requiredFields"));
      return;
    }

    setSentResetCode(result.devCode ?? "");
    setResetCode("");
    setResendSeconds(resendDelaySeconds);
    setNotice(result.devCode && !result.emailSent ? `${t("auth.resetCodeSent")} ${email.trim()}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.resetCodeSent")} ${email.trim()}.`);
    setForgotStep("code");
  };

  const verifyResetCode = async () => {
    setLocalError("");
    if (!resetCode.trim()) {
      setLocalError(t("errors.invalidCode"));
      return;
    }
    if (sentResetCode && resetCode.trim() !== sentResetCode) {
      setLocalError(t("errors.invalidCode"));
      return;
    }

    const ok = await onVerifyPasswordReset(email.trim(), resetCode.trim());
    if (ok) {
      setForgotStep("password");
      setNotice(t("auth.emailConfirmed"));
      return;
    }
    setLocalError(t("errors.invalidCode"));
  };

  const finishReset = async () => {
    setLocalError("");
    if (resetPassword.length <= 6) {
      setLocalError(t("errors.weakPassword"));
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setLocalError(t("errors.passwordMismatch"));
      return;
    }

    const ok = await onFinishPasswordReset(email.trim(), resetCode.trim(), resetPassword);
    if (!ok) setLocalError(t("errors.invalidCode"));
  };

  const resendResetCode = () => {
    if (resendSeconds > 0 || !email.trim()) return;
    void onStartPasswordReset(email.trim()).then((result) => {
      if (!result.ok) return;
      setSentResetCode(result.devCode ?? "");
      setResetCode("");
      setResendSeconds(resendDelaySeconds);
      setNotice(result.devCode && !result.emailSent ? `${t("auth.resetCodeSent")} ${email.trim()}. ${t("auth.demoCode")}: ${result.devCode}` : `${t("auth.resetCodeSent")} ${email.trim()}.`);
    });
  };

  const submit = () => {
    setLocalError("");

    if (mode === "login") {
      onLogin(email.trim(), password);
      return;
    }

    if (mode === "forgot") {
      if (forgotStep === "request") {
        startResetRequest();
        return;
      }
      if (forgotStep === "code") {
        verifyResetCode();
        return;
      }
      finishReset();
      return;
    }

    if (registerStep === "form") {
      startEmailVerification();
      return;
    }

    verifyAndRegister();
  };

  const visibleError = localError || (mode === "login" || mode === "forgot" ? error : "");
  const authTitle = mode === "login" ? t("auth.welcome") : mode === "register" ? t("auth.register") : t("auth.forgotTitle");
  const authSubtitle = mode === "login" ? t("auth.loginSubtitle") : mode === "register" ? t("auth.registerSubtitle") : t("auth.forgotSubtitle");

  return (
    <section className="auth-layout">
      <div className="intro-panel auth-hero">
        <p>{t("auth.kicker")}</p>
        <h2>Tuscolo Cleaning Tracker</h2>
        <span>{t("app.slogan")}</span>
        <div className="italian-rule" aria-hidden="true" />
        <strong>{t("auth.heroCopy")}</strong>
      </div>

      <form
        className="auth-panel"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {mode === "register" && registerStep === "verify" ? null : (
          <div className="auth-panel-heading">
            <h2>{authTitle}</h2>
            <p>{authSubtitle}</p>
          </div>
        )}

        {mode === "forgot" ? (
          <button className="auth-back-button" type="button" onClick={() => switchMode("login")}>
            <ArrowLeft size={17} />
            {t("auth.backToLogin")}
          </button>
        ) : (
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
        )}

        {mode === "forgot" ? (
          <div className="verification-card auth-flow-card">
            {forgotStep === "request" ? <Mail size={36} /> : forgotStep === "code" ? <ShieldCheck size={36} /> : <KeyRound size={36} />}
            <h2>{forgotStep === "request" ? t("auth.resetRequestTitle") : forgotStep === "code" ? t("auth.resetVerifyTitle") : t("auth.newPasswordTitle")}</h2>
            <p>{forgotStep === "request" ? t("auth.resetRequestCopy") : forgotStep === "code" ? t("auth.resetVerifyCopy") : t("auth.newPasswordCopy")}</p>

            {forgotStep === "request" ? (
              <label className="field">
                <span>{t("fields.email")}</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </label>
            ) : null}

            {forgotStep === "code" ? (
              <>
                <label className="field">
                  <span>{t("fields.confirmationCode")}</span>
                  <input value={resetCode} onChange={(event) => setResetCode(event.target.value)} inputMode="numeric" />
                </label>
                {notice ? <p className="notice-text">{notice}</p> : null}
                <div className="resend-code-row">
                  <span>{t("auth.resendPrompt")}</span>
                  <button className={resendSeconds > 0 ? "disabled" : ""} type="button" onClick={resendResetCode} disabled={resendSeconds > 0}>
                    <RotateCw size={16} />
                    {t("auth.resendCode")}
                    {resendSeconds > 0 ? ` ${t("auth.inSeconds")} ${resendSeconds}s` : ""}
                  </button>
                </div>
              </>
            ) : null}

            {forgotStep === "password" ? (
              <>
                {notice ? <p className="notice-text">{notice}</p> : null}
                <label className="field">
                  <span>{t("fields.password")}</span>
                  <div className="password-field">
                    <input value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} type={showResetPassword ? "text" : "password"} />
                    <button type="button" onClick={() => setShowResetPassword((value) => !value)} aria-label={showResetPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
                      {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <label className="field">
                  <span>{t("fields.confirmPassword")}</span>
                  <div className="password-field">
                    <input value={confirmResetPassword} onChange={(event) => setConfirmResetPassword(event.target.value)} type={showResetPassword ? "text" : "password"} />
                    <button type="button" onClick={() => setShowResetPassword((value) => !value)} aria-label={showResetPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
                      {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              </>
            ) : null}

            {visibleError ? <p className="error-text">{visibleError}</p> : null}
            <button className="primary-action" type="submit">
              {forgotStep === "request" ? <Mail size={18} /> : forgotStep === "code" ? <ShieldCheck size={18} /> : <KeyRound size={18} />}
              {forgotStep === "request" ? t("auth.sendResetCode") : forgotStep === "code" ? t("auth.confirmEmail") : t("auth.saveNewPassword")}
            </button>
          </div>
        ) : mode === "register" && registerStep === "verify" ? (
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

            <button className="primary-action" type="submit">
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

            <button className="primary-action" type="submit">
              {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
              {mode === "login" ? t("auth.login") : t("auth.register")}
            </button>

            {mode === "login" ? (
              <button className="auth-link-button" type="button" onClick={() => switchMode("forgot")}>
                {t("auth.forgotPassword")}
              </button>
            ) : null}

          </>
        )}
      </form>
    </section>
  );
}
