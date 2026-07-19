"use client";

import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import { useAuthStore } from "@/store";

const PUBLIC_ROUTES = ["/login"];

const LICENSE_CHECK_KEY =
  "bliss-last-license-check";

const LICENSE_CHECK_INTERVAL =
  24 * 60 * 60 * 1000;

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] =
    useState(true);

  const {
    isAuthenticated,
    logout,
  } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);

      try {
        // LOGIN SAHIFASI
        if (pathname === "/login") {
          if (isAuthenticated) {
            router.replace("/dashboard");
            return;
          }

          setLoading(false);
          return;
        }

        const isPublic =
          PUBLIC_ROUTES.some((route) =>
            pathname.startsWith(route),
          );

        if (isPublic) {
          setLoading(false);
          return;
        }

        // LOCAL STATUS
        const localResponse = await fetch(
          "/crm/local-status",
          {
            cache: "no-store",
          },
        );

        const localData =
          await localResponse.json();

       if (
          !localResponse.ok ||
          !localData?.initialized
        ) {
          logout();
          router.replace("/login");
          return;
        }
        // LOCAL LICENSE
        const expiresAt =
          localData?.license?.expiresAt;

        if (expiresAt) {
          const expiresTime =
            new Date(expiresAt).getTime();

          if (
            Number.isNaN(expiresTime) ||
            expiresTime <= Date.now()
          ) {
            logout();
            router.replace("/login");
            return;
          }
        }

        // ONLINE LICENSE CHECK
        const lastCheck = Number(
          localStorage.getItem(
            LICENSE_CHECK_KEY,
          ) || 0,
        );

        const shouldCheckOnline =
          !lastCheck ||
          Date.now() - lastCheck >
            LICENSE_CHECK_INTERVAL;

        if (shouldCheckOnline) {
          try {
            const licenseResponse =
              await fetch(
                "/crm/check-license",
                {
                  cache: "no-store",
                },
              );

            const licenseData =
              await licenseResponse.json();

            if (
              licenseResponse.ok &&
              licenseData?.success
            ) {
              localStorage.setItem(
                LICENSE_CHECK_KEY,
                String(Date.now()),
              );
            }

            const licenseStatus =
              licenseData?.license?.status;

            if (
              licenseStatus === "expired" ||
              licenseStatus === "blocked"
            ) {
              logout();
              router.replace("/login");
              return;
            }
          } catch (error) {
            console.warn(
              "Online license check skipped:",
              error,
            );
          }
        }

        setLoading(false);
      } catch (error) {
        console.error(
          "AUTH GUARD ERROR:",
          error,
        );

        logout();
        router.replace("/login");
      }
    };

    checkAuth();
  }, [
    pathname,
    isAuthenticated,
    router,
    logout,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />

          <p className="mt-4 text-sm text-gray-500">
            Tizim yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}