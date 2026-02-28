import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { useAuth, requestMagicLink, consumeMagicLink, getMe } from "@/api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [pasteToken, setPasteToken] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (!urlToken?.trim()) return;
    setSearchParams({}, { replace: true });
    consumeMagicLink(urlToken.trim())
      .then(() => getMe())
      .then((user) => {
        if (user) {
          setUser(user);
          sessionStorage.setItem("clawkpit_show_openclaw_after_login", "1");
          navigate("/board", { replace: true });
        }
      })
      .catch(() => {
        setSendError("Invalid or expired link");
      });
  }, [searchParams, setSearchParams, setUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSendError("");
    setSendLoading(true);
    setDevToken(null);
    try {
      const data = await requestMagicLink(email.trim());
      setSubmitted(true);
      if (isDev && data.token) setDevToken(data.token);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send link");
    } finally {
      setSendLoading(false);
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteToken.trim()) return;
    setSendError("");
    setPasteLoading(true);
    try {
      await consumeMagicLink(pasteToken.trim());
      const user = await getMe();
      if (user) {
        setUser(user);
        sessionStorage.setItem("clawkpit_show_openclaw_after_login", "1");
        navigate("/board", { replace: true });
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Invalid or expired link");
    } finally {
      setPasteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground">Clawkpit</div>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Don't have an account?
              </span>
              <Button variant="outline" asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              {submitted
                ? "Check your email for the magic link"
                : "Log in to your Clawkpit account"}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Magic link sent!
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We've sent a login link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the link in your email to log in. The link will expire in
                  15 minutes.
                </p>
              </div>

              {isDev && devToken && (
                <div className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Dev mode: paste the code below to log in without email
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Generated magic link code</Label>
                    <Input
                      readOnly
                      value={devToken}
                      className="font-mono text-xs"
                    />
                  </div>
                  <form onSubmit={handlePasteSubmit} className="space-y-2">
                    <Label htmlFor="paste-token" className="text-xs text-muted-foreground">
                      Or paste code here
                    </Label>
                    <Input
                      id="paste-token"
                      type="text"
                      placeholder="Paste magic link code"
                      value={pasteToken}
                      onChange={(e) => setPasteToken(e.target.value)}
                      className="font-mono text-sm"
                      disabled={pasteLoading}
                    />
                    <Button type="submit" size="sm" disabled={pasteLoading || !pasteToken.trim()}>
                      {pasteLoading ? "Logging in…" : "Log in with code"}
                    </Button>
                  </form>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setDevToken(null);
                  setPasteToken("");
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {sendError && (
                <p className="text-xs text-destructive">{sendError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={sendLoading}
              >
                {sendLoading ? "Sending…" : "Send Magic Link"}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                We'll email you a magic link for a password-free sign in.
              </div>
            </form>
          )}

          {!submitted && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-primary hover:underline font-medium"
              >
                Sign up
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
