import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ConfirmPage() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    const confirmSubscription = async () => {
      try {
        const response = await fetch(`/api/confirm/${token}`);
        if (response.ok) {
          setStatus('success');
        } else {
          const data = await response.json();
          setStatus('error');
          setMessage(data.error || 'Invalid or expired confirmation link.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while confirming your subscription.');
      }
    };

    confirmSubscription();
  }, [token]);

  return (
    <Card className="border-[#e1e4e8] shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden">
      <CardHeader className="p-10 pb-6 text-center">
        <div className="flex justify-center mb-6">
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 text-[#0366d6] animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="w-16 h-16 text-[#2da44e]" />
          )}
          {status === 'error' && (
            <XCircle className="w-16 h-16 text-[#d73a49]" />
          )}
        </div>
        <CardTitle className="text-2xl font-bold text-[#24292e]">
          {status === 'loading' && 'Confirming Subscription...'}
          {status === 'success' && 'Subscription Confirmed!'}
          {status === 'error' && 'Confirmation Failed'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-10 pt-0 text-center">
        {status === 'loading' && (
          <p className="text-base text-[#444d56]">
            Please wait while we verify your email address.
          </p>
        )}
        {status === 'success' && (
          <>
            <p className="text-base text-[#444d56] mb-8">
              Your subscription has been successfully confirmed. You will now
              receive email notifications for new releases.
            </p>
            <Link
              to="/"
              className="inline-flex items-center bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold px-6 py-3 rounded-md transition-colors"
            >
              Go to Homepage
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-base text-[#444d56] mb-8">{message}</p>
            <Link
              to="/"
              className="inline-flex items-center text-[#0366d6] hover:underline font-medium"
            >
              Try subscribing again
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
