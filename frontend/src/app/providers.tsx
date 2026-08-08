"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {darkTheme, RainbowKitProvider} from "@rainbow-me/rainbowkit";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState} from "react";
import {WagmiProvider} from "wagmi";
import {ToastProvider} from "@/components/ui/Toast";
import {WorkspaceProvider} from "@/context/WorkspaceContext";
import {wagmiConfig} from "@/config/wagmi";

const rainbowKitTheme = darkTheme({
  accentColor: "#22d3ee",
  accentColorForeground: "#04121a",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({children}: {children: React.ReactNode}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowKitTheme}>
          <ToastProvider>
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
