'use client';
import { useRef, forwardRef, useImperativeHandle } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

export type HCaptchaHandle = { reset: () => void };

type Props = {
  onVerify: (token: string) => void;
  onExpire: () => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || '';

export const HCaptchaWidget = forwardRef<HCaptchaHandle, Props>(
  ({ onVerify, onExpire }, ref) => {
    const inner = useRef<HCaptcha>(null);

    useImperativeHandle(ref, () => ({
      reset: () => inner.current?.resetCaptcha(),
    }));

    if (!SITE_KEY) return null;

    return (
      <div className="flex justify-center">
        <HCaptcha
          ref={inner}
          sitekey={SITE_KEY}
          onVerify={onVerify}
          onExpire={onExpire}
          size="normal"
        />
      </div>
    );
  }
);
HCaptchaWidget.displayName = 'HCaptchaWidget';
