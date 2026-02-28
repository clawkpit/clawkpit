import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, confirmEmailChange } from "@/api/client";

export function ConfirmEmailChangePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token")?.trim();
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification link.");
      return;
    }
    confirmEmailChange(token)
      .then((user) => {
        setUser(user);
        setStatus("success");
        navigate("/board", { replace: true });
      })
      .catch((e) => {
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "Invalid or expired link.");
      });
  }, [searchParams, setUser, navigate]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Confirming your new email…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-lg font-semibold">Could not confirm email</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <a href="/board" className="text-sm text-primary hover:underline">
            Go to Clawkpit
          </a>
        </div>
      </div>
    );
  }

  return null;
}
