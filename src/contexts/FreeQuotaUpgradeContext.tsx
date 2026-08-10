import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import FreeQuotaExceededDialog from '../components/billing/FreeQuotaExceededDialog';
import type { FreeQuotaKind } from '../hooks/useStructureQuota';

interface FreeQuotaUpgradeContextValue {
  openFreeQuotaDialog: (kind: FreeQuotaKind) => void;
}

const FreeQuotaUpgradeContext = createContext<FreeQuotaUpgradeContextValue | undefined>(undefined);

export const FreeQuotaUpgradeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FreeQuotaKind>('items');

  const openFreeQuotaDialog = useCallback((nextKind: FreeQuotaKind) => {
    setKind(nextKind);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openFreeQuotaDialog }), [openFreeQuotaDialog]);

  return (
    <FreeQuotaUpgradeContext.Provider value={value}>
      {children}
      <FreeQuotaExceededDialog open={open} kind={kind} onClose={() => setOpen(false)} />
    </FreeQuotaUpgradeContext.Provider>
  );
};

export function useFreeQuotaUpgrade(): FreeQuotaUpgradeContextValue {
  const ctx = useContext(FreeQuotaUpgradeContext);
  if (!ctx) {
    throw new Error('useFreeQuotaUpgrade must be used within FreeQuotaUpgradeProvider');
  }
  return ctx;
}
