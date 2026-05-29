"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

function LoginForms() {
  const searchParams = useSearchParams();
  // Deep-link support: /login?mode=signin opens the sign-in view, anything
  // else (the default) opens sign-up so new visitors land on registration.
  const [showSignIn, setShowSignIn] = useState(searchParams.get("mode") === "signin");

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForms />
    </Suspense>
  );
}
