import React from 'react';
import { AmbassadorEventForm } from './AmbassadorEventForm';

const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateEventDialog: React.FC<CreateEventDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 16px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '720px',
          width: '100%',
          padding: '32px',
          backdropFilter: 'blur(20px)',
          maxHeight: 'calc(100vh - 96px)',
          overflow: 'auto',
          fontFamily: appleFont,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <AmbassadorEventForm
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
