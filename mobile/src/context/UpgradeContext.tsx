import { createContext, useContext, type ReactNode } from 'react';

import { confirmAction } from '../lib/confirm';

type Upgrade = {
  // Something in availo+ (personal) or the Aylık paket (business) was tried: say what it gives and offer Abonelik
  promptUpgrade: (message: string) => void;
};

const UpgradeContext = createContext<Upgrade>({ promptUpgrade: () => {} });

/** One place for "Bu availo+ ile / Aylık pakette": the message, and a button to Abonelik. */
export function UpgradeProvider({ business, onOpenSubscription, children }: { business: boolean; onOpenSubscription: () => void; children: ReactNode }) {
  const promptUpgrade = (message: string) =>
    confirmAction(business ? 'Aylık paket' : 'availo+', message, business ? "Aylık paket'e bak" : "availo+'ya bak", onOpenSubscription);
  return <UpgradeContext.Provider value={{ promptUpgrade }}>{children}</UpgradeContext.Provider>;
}

export const useUpgrade = () => useContext(UpgradeContext);
